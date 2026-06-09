import { DateTime } from "luxon";
import { listChannelVideos } from "../youtube/api.js";
import { fetchMyChannels, getAuthorizedClient } from "../youtube/auth.js";
import type { ChannelVideo } from "../youtube/types.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 500;
const DISPLAY_TIMEZONE = "Asia/Tokyo";

export interface VideosListOptions {
  limit?: number;
}

function resolveLimit(limit?: number): number {
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

function displayDateTime(video: ChannelVideo): string {
  if (video.privacyStatus === "private" && video.publishAt) {
    return formatDateTime(video.publishAt);
  }

  return formatDateTime(video.uploadedAt);
}

export async function runVideosList(
  options: VideosListOptions,
): Promise<void> {
  const limit = resolveLimit(options.limit);
  const auth = await getAuthorizedClient();
  const channels = await fetchMyChannels(auth);

  if (channels.length === 0) {
    console.log("No channel associated with the current token.");
    console.log(
      "If you are a Brand Account manager, OAuth may not list that channel. Ask the owner to run auth login instead.",
    );
    return;
  }

  const channel = channels[0];
  const videos = await listChannelVideos(auth, { limit });

  console.log(`Channel: ${channel.title} (${channel.id})`);
  console.log(`Showing latest ${limit} uploaded video(s).`);
  console.log("");

  if (videos.length === 0) {
    console.log("No uploaded videos found.");
    return;
  }

  const idWidth = Math.max(...videos.map((video) => video.id.length), 7);
  const statusWidth = Math.max(
    ...videos.map((video) => video.privacyStatus.length),
    6,
  );
  const dateWidth = Math.max(
    ...videos.map((video) => displayDateTime(video).length),
    20,
  );

  console.log(
    `${"videoId".padEnd(idWidth)}  ${"status".padEnd(statusWidth)}  ${"scheduled/published".padEnd(dateWidth)}  title`,
  );

  for (const video of videos) {
    console.log(
      `${video.id.padEnd(idWidth)}  ${video.privacyStatus.padEnd(statusWidth)}  ${displayDateTime(video).padEnd(dateWidth)}  ${video.title}`,
    );
  }
}
