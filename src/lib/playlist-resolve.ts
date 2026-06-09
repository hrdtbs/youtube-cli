import { loadAppConfig, resolveConfigPath } from "./app-config.js";
import { getDefaultUploadDir } from "./config.js";
import { normalizeAndValidatePlaylistId } from "./playlist-id.js";

export interface ResolvePlaylistIdOptions {
  playlist?: string;
  config?: string;
}

export async function resolvePlaylistId(
  options: ResolvePlaylistIdOptions,
): Promise<string> {
  if (options.playlist) {
    return normalizeAndValidatePlaylistId(options.playlist);
  }

  const configPath = await resolveConfigPath(
    getDefaultUploadDir(),
    options.config,
  );
  const config = await loadAppConfig(configPath);
  const playlistId = config.upload?.playlistId;

  if (!playlistId) {
    throw new Error(
      "playlist is required: pass --playlist or set upload.playlistId in config.yaml",
    );
  }

  return playlistId;
}
