import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { IANAZone } from "luxon";
import {
  CONFIG_FILENAME,
  getDefaultConfigPath,
} from "./config.js";
import type { AppConfig, ScheduleSlot } from "../youtube/types.js";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PLAYLIST_ID_PATTERN = /^[\w-]+$/;

function normalizePlaylistId(value: string): string {
  const trimmed = value.trim();
  const fromUrl = trimmed.match(/[?&]list=([^&]+)/)?.[1];
  return fromUrl ?? trimmed;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function resolveConfigPath(
  uploadDir: string,
  explicit?: string,
): Promise<string> {
  if (explicit) {
    return explicit;
  }

  const inUploadDir = join(uploadDir, CONFIG_FILENAME);
  if (await fileExists(inUploadDir)) {
    return inUploadDir;
  }

  return getDefaultConfigPath();
}

function validateSlot(slot: ScheduleSlot, index: number): void {
  if (typeof slot.weekday !== "number" || slot.weekday < 0 || slot.weekday > 6) {
    throw new Error(
      `schedule.slots[${index}].weekday must be 0-6 (0=Sunday).`,
    );
  }

  if (typeof slot.time !== "string" || !TIME_PATTERN.test(slot.time)) {
    throw new Error(
      `schedule.slots[${index}].time must be HH:mm (24-hour).`,
    );
  }
}

function validateConfig(raw: unknown): AppConfig {
  if (!raw || typeof raw !== "object") {
    throw new Error("Config must be a YAML object.");
  }

  const data = raw as Record<string, unknown>;
  const template = data.template;
  const schedule = data.schedule;

  if (!template || typeof template !== "object") {
    throw new Error("template section is required.");
  }

  if (!schedule || typeof schedule !== "object") {
    throw new Error("schedule section is required.");
  }

  const templateData = template as Record<string, unknown>;
  const scheduleData = schedule as Record<string, unknown>;

  const description = templateData.description;
  if (typeof description !== "string" || description.trim() === "") {
    throw new Error("template.description is required.");
  }

  const tags = templateData.tags;
  if (!Array.isArray(tags)) {
    throw new Error("template.tags must be an array.");
  }

  const timezone = scheduleData.timezone;
  if (typeof timezone !== "string" || timezone.trim() === "") {
    throw new Error("schedule.timezone is required (IANA name, e.g. Asia/Tokyo).");
  }

  const startDate = scheduleData.startDate;
  if (typeof startDate !== "string" || !DATE_PATTERN.test(startDate)) {
    throw new Error("schedule.startDate is required (YYYY-MM-DD).");
  }

  const slots = scheduleData.slots;
  if (!Array.isArray(slots) || slots.length === 0) {
    throw new Error("schedule.slots must be a non-empty array.");
  }

  const parsedSlots: ScheduleSlot[] = slots.map((slot, index) => {
    if (!slot || typeof slot !== "object") {
      throw new Error(`schedule.slots[${index}] must be an object.`);
    }
    const slotData = slot as Record<string, unknown>;
    const parsed: ScheduleSlot = {
      weekday: Number(slotData.weekday),
      time: String(slotData.time),
    };
    validateSlot(parsed, index);
    return parsed;
  });

  const upload = data.upload;
  let uploadConfig: AppConfig["upload"];

  if (upload !== undefined) {
    if (!upload || typeof upload !== "object") {
      throw new Error("upload section must be an object.");
    }

    const uploadData = upload as Record<string, unknown>;
    const rawPlaylistId = uploadData.playlistId;

    if (rawPlaylistId !== undefined) {
      if (typeof rawPlaylistId !== "string" || rawPlaylistId.trim() === "") {
        throw new Error("upload.playlistId must be a non-empty string.");
      }

      const playlistId = normalizePlaylistId(rawPlaylistId);
      if (!PLAYLIST_ID_PATTERN.test(playlistId)) {
        throw new Error(
          "upload.playlistId must be a playlist ID or a URL containing list=.",
        );
      }

      uploadConfig = { playlistId };
    }
  }

  return {
    template: {
      description,
      tags: tags.map(String),
      categoryId: String(templateData.categoryId ?? "22"),
      defaultLanguage: String(templateData.defaultLanguage ?? "ja"),
    },
    schedule: {
      timezone: timezone.trim(),
      startDate,
      slots: parsedSlots,
    },
    upload: uploadConfig,
  };
}

export async function loadAppConfig(path: string): Promise<AppConfig> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Config file not found: ${path}`);
    }
    throw error;
  }

  const parsed = parseYaml(raw);
  const config = validateConfig(parsed);

  if (!IANAZone.isValidZone(config.schedule.timezone)) {
    throw new Error(`Invalid schedule.timezone: ${config.schedule.timezone}`);
  }

  return config;
}
