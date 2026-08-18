import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), ".aurelia", "data");

async function ensureDataDir(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
}

function collectionPath(name: string): string {
  return path.join(DATA_DIR, `${name}.json`);
}

/** Reads a JSON-array collection, returning [] if it doesn't exist yet. */
export async function readCollection<T>(name: string): Promise<T[]> {
  try {
    const raw = await readFile(collectionPath(name), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

/** Writes a JSON-array collection atomically (write to temp file, then rename). */
export async function writeCollection<T>(name: string, items: T[]): Promise<void> {
  await ensureDataDir();
  const file = collectionPath(name);
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmp, JSON.stringify(items, null, 2), "utf8");
  await rename(tmp, file);
}
