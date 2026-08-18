import { randomUUID } from "node:crypto";
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

async function writeCollectionUnlocked<T>(name: string, items: T[]): Promise<void> {
  await ensureDataDir();
  const file = collectionPath(name);
  // randomUUID (not Date.now()) — two writes to the same collection within
  // the same millisecond previously collided on the same temp filename and
  // corrupted each other's output.
  const tmp = `${file}.tmp-${randomUUID()}`;
  await writeFile(tmp, JSON.stringify(items, null, 2), "utf8");
  await rename(tmp, file);
}

// Serializes read-modify-write cycles per collection name, so two concurrent
// mutations (e.g. two PATCH requests in flight) can't race on a stale read
// and silently drop one of the updates ("lost update").
const queues = new Map<string, Promise<unknown>>();

function enqueue<T>(name: string, task: () => Promise<T>): Promise<T> {
  const previous = queues.get(name) ?? Promise.resolve();
  const settled = previous.then(task, task);
  queues.set(
    name,
    settled.then(
      () => undefined,
      () => undefined
    )
  );
  return settled;
}

/** Atomically reads, transforms, and writes back a collection. Use for all mutations. */
export function mutateCollection<T>(name: string, mutate: (items: T[]) => T[] | Promise<T[]>): Promise<T[]> {
  return enqueue(name, async () => {
    const items = await readCollection<T>(name);
    const next = await mutate(items);
    await writeCollectionUnlocked(name, next);
    return next;
  });
}
