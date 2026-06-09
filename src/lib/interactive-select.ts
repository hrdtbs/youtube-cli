import * as p from "@clack/prompts";
import { displayDateTime } from "./channel-video-display.js";
import type { ChannelVideo } from "../youtube/types.js";

function formatVideoOption(video: ChannelVideo, index: number): string {
  return `${index + 1}. ${video.id}  ${video.privacyStatus}  ${displayDateTime(video)}  ${video.title}`;
}

export async function selectVideosFromList(
  videos: ChannelVideo[],
): Promise<string[] | null> {
  const selected = await p.multiselect({
    message: "Select videos to add to the playlist",
    options: videos.map((video, index) => ({
      value: video.id,
      label: formatVideoOption(video, index),
    })),
  });

  if (p.isCancel(selected)) {
    p.cancel("Selection cancelled.");
    return null;
  }

  if (selected.length === 0) {
    console.log("No videos selected.");
    return null;
  }

  return selected;
}
