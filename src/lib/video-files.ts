import { readdir, stat } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { VIDEO_EXTENSIONS } from "./config.js";

export interface VideoFile {
  absolutePath: string;
  relativePath: string;
}

function isVideoFile(name: string): boolean {
  return VIDEO_EXTENSIONS.has(extname(name).toLowerCase());
}

async function walkDir(
  rootDir: string,
  currentDir: string,
  recursive: boolean,
  results: VideoFile[],
): Promise<void> {
  const entries = await readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(currentDir, entry.name);

    if (entry.isDirectory()) {
      if (recursive) {
        await walkDir(rootDir, fullPath, recursive, results);
      }
      continue;
    }

    if (!entry.isFile() || !isVideoFile(entry.name)) {
      continue;
    }

    results.push({
      absolutePath: fullPath,
      relativePath: relative(rootDir, fullPath).replaceAll("\\", "/"),
    });
  }
}

export async function listVideoFiles(
  rootDir: string,
  recursive = false,
): Promise<VideoFile[]> {
  const info = await stat(rootDir).catch(() => null);
  if (!info?.isDirectory()) {
    throw new Error(`Video directory not found: ${rootDir}`);
  }

  const results: VideoFile[] = [];
  await walkDir(rootDir, rootDir, recursive, results);

  return results.sort((a, b) =>
    a.relativePath.localeCompare(b.relativePath, undefined, {
      sensitivity: "base",
    }),
  );
}
