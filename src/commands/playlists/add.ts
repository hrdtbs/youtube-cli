import { withChannelContext } from "../../lib/channel-context.js";
import {
  printChannelVideosTable,
  resolveVideoListLimit,
} from "../../lib/channel-video-display.js";
import { selectVideosFromList } from "../../lib/interactive-select.js";
import { resolvePlaylistId } from "../../lib/playlist-resolve.js";
import { addVideoToPlaylist, listChannelVideos } from "../../youtube/api.js";

export interface PlaylistsAddOptions {
  playlist?: string;
  config?: string;
  limit?: number;
}

export async function runPlaylistsAdd(
  options: PlaylistsAddOptions,
): Promise<void> {
  const limit = resolveVideoListLimit(options.limit);
  const context = await withChannelContext();

  if (!context) {
    return;
  }

  const playlistId = await resolvePlaylistId({
    playlist: options.playlist,
    config: options.config,
  });

  const videos = await listChannelVideos(context.auth, { limit });

  if (videos.length === 0) {
    printChannelVideosTable(videos, context.channel, { limit });
    return;
  }

  printChannelVideosTable(videos, context.channel, { limit, numbered: true });
  console.log("");

  const selectedIds = await selectVideosFromList(videos);

  if (!selectedIds) {
    return;
  }

  console.log(`Playlist: ${playlistId}`);
  console.log(`Adding ${selectedIds.length} video(s)...`);
  console.log("");

  let added = 0;
  let failed = 0;

  for (const videoId of selectedIds) {
    const video = videos.find((item) => item.id === videoId);
    const label = video ? `${videoId} (${video.title})` : videoId;

    try {
      await addVideoToPlaylist(context.auth, videoId, playlistId);
      console.log(`  added: ${label}`);
      added += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  warning: failed to add ${label} - ${message}`);
      failed += 1;
    }
  }

  console.log("");
  console.log(
    `Summary - added: ${added}, failed: ${failed}, playlist: ${playlistId}`,
  );
}
