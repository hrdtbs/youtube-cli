import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { INDEX_FILENAME } from "./config.js";

export interface UploadRecord {
  filename: string;
  relativePath: string;
  videoId: string;
  publishAt: string;
  uploadedAt: string;
}

interface IndexData {
  uploads: UploadRecord[];
}

function indexPath(uploadDir: string): string {
  return join(uploadDir, INDEX_FILENAME);
}

async function readIndex(uploadDir: string): Promise<IndexData> {
  try {
    const raw = await readFile(indexPath(uploadDir), "utf8");
    const data = JSON.parse(raw) as IndexData;
    return {
      uploads: data.uploads ?? [],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { uploads: [] };
    }
    throw error;
  }
}

export class UploadIndex {
  private readonly records = new Map<string, UploadRecord>();

  private constructor(uploads: UploadRecord[]) {
    for (const record of uploads) {
      this.records.set(record.relativePath, record);
    }
  }

  static async load(uploadDir: string): Promise<UploadIndex> {
    const data = await readIndex(uploadDir);
    return new UploadIndex(data.uploads);
  }

  has(relativePath: string): boolean {
    return this.records.has(relativePath);
  }

  getAll(): UploadRecord[] {
    return [...this.records.values()];
  }

  async markUploaded(
    uploadDir: string,
    record: UploadRecord,
  ): Promise<void> {
    this.records.set(record.relativePath, record);
    const data: IndexData = {
      uploads: [...this.records.values()].sort((a, b) =>
        a.relativePath.localeCompare(b.relativePath),
      ),
    };
    await writeFile(indexPath(uploadDir), JSON.stringify(data, null, 2), "utf8");
  }
}
