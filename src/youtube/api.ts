import { createReadStream } from "node:fs";
import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import type { ChannelVideo, VideoCategory, VideoMetadata } from "./types.js";

const PLAYLIST_ITEMS_PAGE_SIZE = 50;
const VIDEOS_LIST_BATCH_SIZE = 50;

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

export async function getUploadsPlaylistId(
  auth: OAuth2Client,
): Promise<string> {
  const youtube = google.youtube({ version: "v3", auth });

  const response = await youtube.channels.list({
    part: ["contentDetails"],
    mine: true,
  });

  const uploadsId =
    response.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

  if (!uploadsId) {
    throw new Error(
      "No channel associated with the current token. Run: youtube auth channels",
    );
  }

  return uploadsId;
}

interface PlaylistVideoStub {
  id: string;
  title: string;
  uploadedAt: string;
}

async function listPlaylistVideoStubs(
  auth: OAuth2Client,
  playlistId: string,
  limit: number,
): Promise<PlaylistVideoStub[]> {
  const youtube = google.youtube({ version: "v3", auth });
  const stubs: PlaylistVideoStub[] = [];
  let pageToken: string | undefined;

  while (stubs.length < limit) {
    const maxResults = Math.min(
      PLAYLIST_ITEMS_PAGE_SIZE,
      limit - stubs.length,
    );

    const response = await youtube.playlistItems.list({
      part: ["snippet"],
      playlistId,
      maxResults,
      pageToken,
    });

    for (const item of response.data.items ?? []) {
      const videoId = item.snippet?.resourceId?.videoId;
      const title = item.snippet?.title;
      const uploadedAt = item.snippet?.publishedAt;

      if (!videoId || !title || !uploadedAt) {
        continue;
      }

      stubs.push({ id: videoId, title, uploadedAt });

      if (stubs.length >= limit) {
        break;
      }
    }

    pageToken = response.data.nextPageToken ?? undefined;
    if (!pageToken) {
      break;
    }
  }

  return stubs;
}

async function fetchVideoStatuses(
  auth: OAuth2Client,
  videoIds: string[],
): Promise<Map<string, { privacyStatus: string; publishAt?: string }>> {
  const youtube = google.youtube({ version: "v3", auth });
  const statuses = new Map<
    string,
    { privacyStatus: string; publishAt?: string }
  >();

  for (let i = 0; i < videoIds.length; i += VIDEOS_LIST_BATCH_SIZE) {
    const batch = videoIds.slice(i, i + VIDEOS_LIST_BATCH_SIZE);

    const response = await youtube.videos.list({
      part: ["status"],
      id: batch,
    });

    for (const item of response.data.items ?? []) {
      if (!item.id || !item.status?.privacyStatus) {
        continue;
      }

      statuses.set(item.id, {
        privacyStatus: item.status.privacyStatus,
        publishAt: item.status.publishAt ?? undefined,
      });
    }
  }

  return statuses;
}

export async function listChannelVideos(
  auth: OAuth2Client,
  options: { limit: number },
): Promise<ChannelVideo[]> {
  const uploadsPlaylistId = await getUploadsPlaylistId(auth);
  const stubs = await listPlaylistVideoStubs(
    auth,
    uploadsPlaylistId,
    options.limit,
  );

  if (stubs.length === 0) {
    return [];
  }

  const statuses = await fetchVideoStatuses(
    auth,
    stubs.map((stub) => stub.id),
  );

  return stubs.map((stub) => {
    const status = statuses.get(stub.id);
    return {
      id: stub.id,
      title: stub.title,
      uploadedAt: stub.uploadedAt,
      privacyStatus: status?.privacyStatus ?? "unknown",
      publishAt: status?.publishAt,
    };
  });
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
