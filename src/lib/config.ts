import { homedir } from "node:os";
import { join } from "node:path";

export const CLI_NAME = "youtube";
export const APP_NAME = "youtube-cli";

export const YOUTUBE_UPLOAD_SCOPE =
  "https://www.googleapis.com/auth/youtube.upload";

/** Playlist edits require a broader scope than upload-only. */
export const YOUTUBE_FORCE_SSL_SCOPE =
  "https://www.googleapis.com/auth/youtube.force-ssl";

export const YOUTUBE_SCOPES = [
  YOUTUBE_UPLOAD_SCOPE,
  YOUTUBE_FORCE_SSL_SCOPE,
];

export const DEFAULT_CLIENT_SECRET_PATH = "./client_secret.json";
export const CONFIG_FILENAME = "config.yaml";
export const INDEX_FILENAME = ".youtube-cli-index.json";
export const TOKEN_FILENAME = "token.json";

export const VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".mov",
  ".mkv",
  ".webm",
]);

function configDirFor(appName: string): string {
  if (process.platform === "win32") {
    const appData = process.env.APPDATA;
    if (appData) {
      return join(appData, appName);
    }
  }

  const xdgConfig = process.env.XDG_CONFIG_HOME;
  if (xdgConfig) {
    return join(xdgConfig, appName);
  }

  return join(homedir(), ".config", appName);
}

export function getConfigDir(): string {
  return configDirFor(APP_NAME);
}

export function getTokenPath(): string {
  return join(getConfigDir(), TOKEN_FILENAME);
}

export function getDefaultConfigPath(): string {
  return join(getConfigDir(), CONFIG_FILENAME);
}

export function getDefaultUploadDir(): string {
  return process.env.YOUTUBE_UPLOAD_DIR ?? "./videos";
}

export function resolveClientSecretPath(explicit?: string): string {
  return (
    explicit ??
    process.env.YOUTUBE_CLIENT_SECRET_PATH ??
    DEFAULT_CLIENT_SECRET_PATH
  );
}
