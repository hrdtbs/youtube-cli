import { basename } from "node:path";
import { loadAppConfig, resolveConfigPath } from "../lib/app-config.js";
import { getDefaultUploadDir } from "../lib/config.js";
import { UploadIndex } from "../lib/local-index.js";
import { createScheduleIterator } from "../lib/schedule.js";
import { buildMetadata } from "../lib/templates.js";
import { listVideoFiles } from "../lib/video-files.js";
import { addVideoToPlaylist, uploadScheduledVideo } from "../youtube/api.js";
import { AuthError, getAuthorizedClient } from "../youtube/auth.js";
import type { UploadSummary } from "../youtube/types.js";

export interface UploadOptions {
  dir?: string;
  config?: string;
  dryRun?: boolean;
  delay?: number;
  recursive?: boolean;
  force?: boolean;
}

function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

function logDescriptionPreview(description: string): void {
  console.log("  description:");
  for (const line of description.split("\n")) {
    console.log(`    ${line}`);
  }
}

export async function runUpload(options: UploadOptions): Promise<UploadSummary> {
  const uploadDir = options.dir ?? getDefaultUploadDir();
  const dryRun = options.dryRun ?? false;
  const delaySeconds = options.delay ?? 10;
  const recursive = options.recursive ?? false;
  const force = options.force ?? false;

  const configPath = await resolveConfigPath(uploadDir, options.config);
  const config = await loadAppConfig(configPath);
  console.log(`Config: ${configPath}`);
  console.log(`Upload dir: ${uploadDir}`);
  console.log(`Timezone: ${config.schedule.timezone}`);
  console.log(`Start date: ${config.schedule.startDate}`);
  if (config.upload?.playlistId) {
    console.log(`Playlist: ${config.upload.playlistId}`);
  }

  const videos = await listVideoFiles(uploadDir, recursive);
  console.log(`Videos found: ${videos.length}`);

  if (videos.length === 0) {
    return { uploaded: 0, skipped: 0, failed: 0 };
  }

  const index = await UploadIndex.load(uploadDir);
  const pending = force
    ? videos
    : videos.filter((video) => !index.has(video.relativePath));

  const skipped = videos.length - pending.length;
  if (skipped > 0) {
    console.log(`Already uploaded (skipped): ${skipped}`);
  }

  if (pending.length === 0) {
    console.log("Nothing to upload.");
    return { uploaded: 0, skipped, failed: 0 };
  }

  const scheduleIterator = createScheduleIterator(
    config.schedule,
    pending.length,
  );

  const summary: UploadSummary = {
    uploaded: 0,
    skipped,
    failed: 0,
  };

  let authClient: Awaited<ReturnType<typeof getAuthorizedClient>> | null =
    null;
  if (!dryRun) {
    authClient = await getAuthorizedClient();
  }

  for (const video of pending) {
    const slot = scheduleIterator.next().value;
    if (!slot) {
      throw new Error("Schedule iterator exhausted unexpectedly.");
    }

    const metadata = buildMetadata(video.absolutePath, config.template);
    const displayName = video.relativePath;

    if (dryRun) {
      console.log("");
      console.log(`[dry-run] ${displayName}`);
      console.log(`  title: ${metadata.title}`);
      logDescriptionPreview(metadata.description);
      console.log(`  publishAt (local): ${slot.publishAtLocal}`);
      console.log(`  publishAt (UTC): ${slot.publishAtUtc}`);
      if (config.upload?.playlistId) {
        console.log(`  playlist: ${config.upload.playlistId}`);
      }
      continue;
    }

    try {
      console.log("");
      console.log(`Uploading: ${displayName}`);
      console.log(`  title: ${metadata.title}`);
      console.log(`  publishAt (local): ${slot.publishAtLocal}`);
      console.log(`  publishAt (UTC): ${slot.publishAtUtc}`);

      const videoId = await uploadScheduledVideo(
        authClient!,
        video.absolutePath,
        metadata,
        slot.publishAtUtc,
      );

      if (config.upload?.playlistId) {
        try {
          await addVideoToPlaylist(
            authClient!,
            videoId,
            config.upload.playlistId,
          );
          console.log(`  playlist: added to ${config.upload.playlistId}`);
        } catch (playlistError) {
          const playlistMessage =
            playlistError instanceof Error
              ? playlistError.message
              : String(playlistError);
          console.error(
            `  warning: uploaded but failed to add to playlist - ${playlistMessage}`,
          );
        }
      }

      await index.markUploaded(uploadDir, {
        filename: basename(video.absolutePath),
        relativePath: video.relativePath,
        videoId,
        publishAt: slot.publishAtUtc,
        uploadedAt: new Date().toISOString(),
      });

      summary.uploaded += 1;
      console.log(`  videoId: ${videoId}`);

      if (delaySeconds > 0) {
        await sleep(delaySeconds);
      }
    } catch (error) {
      summary.failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Failed: ${displayName} - ${message}`);

      if (error instanceof AuthError) {
        throw error;
      }
    }
  }

  console.log("");
  console.log(
    `Summary - uploaded: ${summary.uploaded}, skipped: ${summary.skipped}, failed: ${summary.failed}`,
  );

  return summary;
}
