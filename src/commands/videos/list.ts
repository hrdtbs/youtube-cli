import { withChannelContext } from "../../lib/channel-context.js";
import {
  printChannelVideosTable,
  resolveVideoListLimit,
} from "../../lib/channel-video-display.js";
import { listChannelVideos } from "../../youtube/api.js";

export interface VideosListOptions {
  limit?: number;
}

export async function runVideosList(
  options: VideosListOptions,
): Promise<void> {
  const limit = resolveVideoListLimit(options.limit);
  const context = await withChannelContext();

  if (!context) {
    return;
  }

  const videos = await listChannelVideos(context.auth, { limit });
  printChannelVideosTable(videos, context.channel, { limit });
}
