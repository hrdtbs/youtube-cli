import { createReadStream } from "node:fs";
import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import type { VideoCategory, VideoMetadata } from "./types.js";

export async function uploadScheduledVideo(
  auth: OAuth2Client,
  filePath: string,
  metadata: VideoMetadata,
  publishAtUtc: string,
): Promise<string> {
  const youtube = google.youtube({ version: "v3", auth });

  const response = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title: metadata.title,
        description: metadata.description,
        tags: metadata.tags,
        categoryId: metadata.categoryId,
        defaultLanguage: metadata.defaultLanguage,
      },
      status: {
        privacyStatus: "private",
        publishAt: publishAtUtc,
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      body: createReadStream(filePath),
    },
  });

  const videoId = response.data.id;
  if (!videoId) {
    throw new Error("YouTube API did not return a video ID.");
  }

  return videoId;
}

export async function listVideoCategories(
  auth: OAuth2Client,
  options: { regionCode: string; hl?: string },
): Promise<VideoCategory[]> {
  const youtube = google.youtube({ version: "v3", auth });

  const response = await youtube.videoCategories.list({
    part: ["snippet"],
    regionCode: options.regionCode,
    hl: options.hl,
  });

  const items = response.data.items ?? [];
  return items
    .filter((item) => item.id && item.snippet?.title)
    .map((item) => ({
      id: item.id!,
      title: item.snippet!.title!,
      assignable: item.snippet!.assignable ?? false,
    }))
    .sort((a, b) =>
      Number.parseInt(a.id, 10) - Number.parseInt(b.id, 10),
    );
}

export async function addVideoToPlaylist(
  auth: OAuth2Client,
  videoId: string,
  playlistId: string,
): Promise<void> {
  const youtube = google.youtube({ version: "v3", auth });

  await youtube.playlistItems.insert({
    part: ["snippet"],
    requestBody: {
      snippet: {
        playlistId,
        resourceId: {
          kind: "youtube#video",
          videoId,
        },
      },
    },
  });
}
