import { open, readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { LogEvent } from "@/lib/types";

export interface SessionSummary {
  id: string;
  cwd: string | null;
  gitBranch: string | null;
  lastActivity: string;
  sizeBytes: number;
}

export interface SessionEventsResult {
  events: LogEvent[];
  nextOffset: number;
}

const SESSION_ID_PATTERN = /^[a-zA-Z0-9-]{1,128}$/;
const HEADER_SCAN_BYTES = 8192;
const INITIAL_TAIL_BYTES = 64 * 1024;
const MAX_EVENTS_PER_RESPONSE = 200;

export function isValidSessionId(id: string): boolean {
  return SESSION_ID_PATTERN.test(id);
}

function sanitizePathForDirName(p: string): string {
  return p.replace(/[\\/:]/g, "-");
}

/**
 * Claude Code writes one append-only JSONL transcript per session under
 * ~/.claude/projects/<sanitized-cwd>/. Deriving the directory from the
 * server's own process.cwd() (never from a client-supplied value) is what
 * keeps this scoped to this project only — there is no way to ask it for
 * another project's sessions.
 */
export function getProjectSessionsDir(): string {
  return path.join(os.homedir(), ".claude", "projects", sanitizePathForDirName(process.cwd()));
}

async function readHeaderMeta(filePath: string): Promise<{ cwd: string | null; gitBranch: string | null }> {
  const handle = await open(filePath, "r");
  try {
    const buffer = Buffer.alloc(HEADER_SCAN_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, HEADER_SCAN_BYTES, 0);
    const lines = buffer.subarray(0, bytesRead).toString("utf8").split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        if (obj.cwd || obj.gitBranch) {
          return { cwd: obj.cwd ?? null, gitBranch: obj.gitBranch ?? null };
        }
      } catch {
        // Likely a partial line at the end of our scan window — ignore.
      }
    }
    return { cwd: null, gitBranch: null };
  } finally {
    await handle.close();
  }
}

export async function listSessions(): Promise<SessionSummary[]> {
  const dir = getProjectSessionsDir();

  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }

  const files = entries.filter((f) => f.endsWith(".jsonl"));

  const summaries = await Promise.all(
    files.map(async (file): Promise<SessionSummary> => {
      const id = file.slice(0, -".jsonl".length);
      const filePath = path.join(dir, file);
      const [fileStat, header] = await Promise.all([stat(filePath), readHeaderMeta(filePath)]);
      return {
        id,
        cwd: header.cwd,
        gitBranch: header.gitBranch,
        lastActivity: fileStat.mtime.toISOString(),
        sizeBytes: fileStat.size,
      };
    })
  );

  return summaries.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
}

function extractTextBlock(block: unknown): string | null {
  if (typeof block === "string") return block;
  if (block && typeof block === "object" && "type" in block) {
    const b = block as { type?: string; text?: string };
    if (b.type === "text" && typeof b.text === "string") return b.text;
  }
  return null;
}

function truncate(text: string, max = 180): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function formatTimestamp(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("en-US", { hour12: false });
}

/** Maps one raw JSONL transcript line to zero or more compact log lines. */
function parseLine(raw: string, lineId: string): LogEvent[] {
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(raw);
  } catch {
    return [];
  }

  const timestamp = formatTimestamp(obj.timestamp);
  const type = typeof obj.type === "string" ? obj.type : null;

  if (type === "user") {
    const content = (obj.message as { content?: unknown } | undefined)?.content;
    const text = typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content.map(extractTextBlock).filter((t): t is string => Boolean(t)).join(" ")
        : "";
    if (!text) return [];
    return [{ id: `${lineId}`, timestamp, level: "info", source: "operator", message: truncate(text) }];
  }

  if (type === "assistant") {
    const content = (obj.message as { content?: unknown } | undefined)?.content;
    if (typeof content === "string") {
      return content ? [{ id: `${lineId}`, timestamp, level: "info", source: "aurelia", message: truncate(content) }] : [];
    }
    if (!Array.isArray(content)) return [];

    const events: LogEvent[] = [];
    content.forEach((block, i) => {
      const text = extractTextBlock(block);
      if (text) {
        events.push({ id: `${lineId}-${i}`, timestamp, level: "info", source: "aurelia", message: truncate(text) });
        return;
      }
      if (block && typeof block === "object" && (block as { type?: string }).type === "tool_use") {
        const name = (block as { name?: string }).name ?? "unknown";
        events.push({ id: `${lineId}-${i}`, timestamp, level: "trace", source: "tool", message: `tool_use → ${name}` });
      }
    });
    return events;
  }

  if (type === "queue-operation") {
    const operation = typeof obj.operation === "string" ? obj.operation : "queue-operation";
    return [{ id: lineId, timestamp, level: "trace", source: "queue", message: operation }];
  }

  if (type) {
    return [{ id: lineId, timestamp, level: "trace", source: "system", message: type }];
  }

  return [];
}

/**
 * Tails a session's transcript from a byte offset. With no offset, starts
 * near the end of the file (last ~64KB) rather than parsing the whole
 * transcript, matching `tail -f` rather than `cat`.
 */
export async function readEventsSince(sessionId: string, offset?: number): Promise<SessionEventsResult> {
  const filePath = path.join(getProjectSessionsDir(), `${sessionId}.jsonl`);
  const handle = await open(filePath, "r");
  try {
    const fileStat = await handle.stat();
    const size = fileStat.size;
    const startOffset = offset === undefined ? Math.max(0, size - INITIAL_TAIL_BYTES) : Math.min(Math.max(0, offset), size);

    if (startOffset >= size) {
      return { events: [], nextOffset: size };
    }

    const length = size - startOffset;
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, startOffset);
    const text = buffer.toString("utf8");

    const endsWithNewline = text.endsWith("\n");
    const parts = text.split("\n");
    const partial = endsWithNewline ? "" : (parts.pop() ?? "");
    const consumedText = endsWithNewline ? text : text.slice(0, text.length - partial.length);
    const consumedBytes = Buffer.byteLength(consumedText, "utf8");

    const events = parts
      .filter((line) => line.trim().length > 0)
      .flatMap((line, i) => parseLine(line, `${sessionId}-${startOffset}-${i}`));

    return {
      events: events.slice(-MAX_EVENTS_PER_RESPONSE),
      nextOffset: startOffset + consumedBytes,
    };
  } finally {
    await handle.close();
  }
}
