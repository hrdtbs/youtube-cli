import { DateTime } from "luxon";
import type { AuthenticatedChannel } from "../youtube/auth.js";
import type { ChannelVideo } from "../youtube/types.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 500;
const DISPLAY_TIMEZONE = "Asia/Tokyo";

export function resolveVideoListLimit(limit?: number): number {
  const value = limit ?? DEFAULT_LIMIT;

  if (!Number.isFinite(value) || value < 1) {
    throw new Error(
      `--limit must be a positive number between 1 and ${MAX_LIMIT}. Got: ${limit}`,
    );
  }

  if (value > MAX_LIMIT) {
    throw new Error(`--limit cannot exceed ${MAX_LIMIT}. Got: ${value}`);
  }

  return Math.floor(value);
}

function formatDateTime(iso: string): string {
  const parsed = DateTime.fromISO(iso, { zone: "utc" }).setZone(
    DISPLAY_TIMEZONE,
  );

  if (!parsed.isValid) {
    return iso;
  }

  return `${parsed.toFormat("yyyy-MM-dd HH:mm")} JST`;
}

export function displayDateTime(video: ChannelVideo): string {
  if (video.privacyStatus === "private" && video.publishAt) {
    return formatDateTime(video.publishAt);
  }

  return formatDateTime(video.uploadedAt);
}

export interface PrintChannelVideosTableOptions {
  limit: number;
  numbered?: boolean;
}

export function printChannelVideosTable(
  videos: ChannelVideo[],
  channel: AuthenticatedChannel,
  options: PrintChannelVideosTableOptions,
): void {
  const { limit, numbered = false } = options;

  console.log(`Channel: ${channel.title} (${channel.id})`);
  console.log(`Showing latest ${limit} uploaded video(s).`);
  console.log("");

  if (videos.length === 0) {
    console.log("No uploaded videos found.");
    return;
  }

  const indexWidth = numbered
    ? Math.max(String(videos.length).length, 1)
    : 0;
  const idWidth = Math.max(...videos.map((video) => video.id.length), 7);
  const statusWidth = Math.max(
    ...videos.map((video) => video.privacyStatus.length),
    6,
  );
  const dateWidth = Math.max(
    ...videos.map((video) => displayDateTime(video).length),
    20,
  );

  const indexHeader = numbered ? `${"#".padEnd(indexWidth)}  ` : "";
  console.log(
    `${indexHeader}${"videoId".padEnd(idWidth)}  ${"status".padEnd(statusWidth)}  ${"scheduled/published".padEnd(dateWidth)}  title`,
  );

  for (let index = 0; index < videos.length; index += 1) {
    const video = videos[index];
    const indexColumn = numbered
      ? `${String(index + 1).padEnd(indexWidth)}  `
      : "";

    console.log(
      `${indexColumn}${video.id.padEnd(idWidth)}  ${video.privacyStatus.padEnd(statusWidth)}  ${displayDateTime(video).padEnd(dateWidth)}  ${video.title}`,
    );
  }
}
