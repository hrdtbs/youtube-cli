const PLAYLIST_ID_PATTERN = /^[\w-]+$/;

export function normalizePlaylistId(value: string): string {
  const trimmed = value.trim();
  const fromUrl = trimmed.match(/[?&]list=([^&]+)/)?.[1];
  return fromUrl ?? trimmed;
}

export function normalizeAndValidatePlaylistId(value: string): string {
  const playlistId = normalizePlaylistId(value);

  if (!PLAYLIST_ID_PATTERN.test(playlistId)) {
    throw new Error(
      "playlist must be a playlist ID or a URL containing list=.",
    );
  }

  return playlistId;
}
