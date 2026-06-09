import { DateTime } from "luxon";
import type { OAuth2Client } from "google-auth-library";
import { listChannelVideos } from "../youtube/api.js";
import type { ChannelVideo, ScheduleConfig } from "../youtube/types.js";
import { UploadIndex } from "./local-index.js";

export const START_DATE_AUTO = "auto";

export function isAutoStartDate(startDate: string): boolean {
  return startDate === START_DATE_AUTO;
}

function effectivePublishAt(video: ChannelVideo): string {
  if (video.privacyStatus === "private" && video.publishAt) {
    return video.publishAt;
  }

  return video.uploadedAt;
}

function considerLatest(
  latestUtc: DateTime | null,
  iso: string,
): DateTime | null {
  const parsed = DateTime.fromISO(iso, { zone: "utc" });
  if (!parsed.isValid) {
    return latestUtc;
  }

  if (!latestUtc || parsed > latestUtc) {
    return parsed;
  }

  return latestUtc;
}

export async function resolveStartDate(options: {
  uploadDir: string;
  schedule: ScheduleConfig;
  auth?: OAuth2Client | null;
}): Promise<string> {
  const { uploadDir, schedule, auth } = options;
  const timezone = schedule.timezone;

  let latestUtc: DateTime | null = null;

  const index = await UploadIndex.load(uploadDir);
  for (const record of index.getAll()) {
    latestUtc = considerLatest(latestUtc, record.publishAt);
  }

  if (auth) {
    const videos = await listChannelVideos(auth, { limit: 50 });
    for (const video of videos) {
      latestUtc = considerLatest(latestUtc, effectivePublishAt(video));
    }
  }

  if (!latestUtc) {
    return DateTime.now().setZone(timezone).toFormat("yyyy-MM-dd");
  }

  return latestUtc
    .setZone(timezone)
    .startOf("day")
    .plus({ days: 1 })
    .toFormat("yyyy-MM-dd");
}
