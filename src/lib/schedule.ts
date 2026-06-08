import { DateTime, IANAZone } from "luxon";
import type { ScheduleConfig, ScheduledSlot } from "../youtube/types.js";

const MIN_LEAD_MS = 15 * 60 * 1000;

interface SlotOccurrence {
  local: DateTime;
  utc: DateTime;
}

function jsWeekdayToLuxon(weekday: number): number {
  return weekday === 0 ? 7 : weekday;
}

function sundayWeekStart(date: DateTime): DateTime {
  return date.minus({ days: date.weekday % 7 }).startOf("day");
}

function parseStartDate(startDate: string, timezone: string): DateTime {
  const parsed = DateTime.fromISO(startDate, { zone: timezone });
  if (!parsed.isValid) {
    throw new Error(`Invalid schedule.startDate: ${startDate}`);
  }
  return parsed.startOf("day");
}

function sortSlots(schedule: ScheduleConfig): ScheduleConfig["slots"] {
  return [...schedule.slots].sort((a, b) => {
    if (a.weekday !== b.weekday) {
      return a.weekday - b.weekday;
    }
    return a.time.localeCompare(b.time);
  });
}

function slotOccurrenceInWeek(
  weekStartSunday: DateTime,
  slot: ScheduleConfig["slots"][number],
): SlotOccurrence | null {
  const [hour, minute] = slot.time.split(":").map(Number);
  const targetWeekday = jsWeekdayToLuxon(slot.weekday);
  const daysFromWeekStart = (targetWeekday - weekStartSunday.weekday + 7) % 7;
  const local = weekStartSunday
    .plus({ days: daysFromWeekStart })
    .set({ hour, minute, second: 0, millisecond: 0 });

  if (!local.isValid) {
    return null;
  }

  return {
    local,
    utc: local.toUTC(),
  };
}

function* generateOccurrences(
  schedule: ScheduleConfig,
): Generator<SlotOccurrence> {
  const sorted = sortSlots(schedule);
  const startDate = parseStartDate(schedule.startDate, schedule.timezone);
  let weekStart = sundayWeekStart(startDate);

  for (let week = 0; week < 520; week += 1) {
    const currentWeekStart = weekStart.plus({ weeks: week });

    for (const slot of sorted) {
      const occurrence = slotOccurrenceInWeek(currentWeekStart, slot);
      if (!occurrence) {
        continue;
      }

      if (occurrence.local < startDate) {
        continue;
      }

      yield occurrence;
    }
  }
}

function formatSlot(slot: SlotOccurrence, timezone: string): ScheduledSlot {
  const publishAtUtc = slot.utc.toISO() ?? slot.utc.toUTC().toISO()!;
  const publishAtLocal =
    slot.local.setZone(timezone).toFormat("yyyy-MM-dd HH:mm") +
    ` (${timezone})`;

  return {
    publishAtUtc,
    publishAtLocal,
  };
}

export function* createScheduleIterator(
  schedule: ScheduleConfig,
  count: number,
  now: DateTime = DateTime.utc(),
): Generator<ScheduledSlot> {
  if (!IANAZone.isValidZone(schedule.timezone)) {
    throw new Error(`Invalid schedule.timezone: ${schedule.timezone}`);
  }

  const minPublishAt = now.plus({ milliseconds: MIN_LEAD_MS });
  const occurrences = generateOccurrences(schedule);
  let assigned = 0;

  for (const occurrence of occurrences) {
    if (assigned >= count) {
      break;
    }

    if (occurrence.utc < minPublishAt) {
      continue;
    }

    yield formatSlot(occurrence, schedule.timezone);
    assigned += 1;
  }

  if (assigned < count) {
    throw new Error(
      `Could not assign ${count} publish slot(s). Only ${assigned} future slot(s) found within the schedule horizon.`,
    );
  }
}
