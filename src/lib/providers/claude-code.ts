import { execFile, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { promisify } from "node:util";
import { CLAUDE_CODE_MODEL_VALUES } from "@/lib/providers/catalog";
import type { ProviderCheck } from "@/lib/providers/types";

const execFileAsync = promisify(execFile);
const TIMEOUT_MS = 3000;
const DISPATCH_TIMEOUT_MS = 4 * 60 * 1000;

export function getClaudeCodeBin(): string {
  return process.env.CLAUDE_CODE_BIN?.trim() || "claude";
}

/**
 * Checks whether the Claude Code CLI is installed and runnable in this
 * environment (`claude --version`). Does not start a session or spend any
 * tokens — this is a presence/availability probe only.
 */
export const claudeCodeProvider: ProviderCheck = {
  id: "claude-code",
  label: "Claude Code CLI",
  async check() {
    const bin = getClaudeCodeBin();
    try {
      const { stdout } = await execFileAsync(bin, ["--version"], { timeout: TIMEOUT_MS });
      const version = stdout.trim().split("\n")[0] || "unknown version";
      return { status: "ready" as const, detail: version, models: CLAUDE_CODE_MODEL_VALUES };
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === "ENOENT") {
        return { status: "unreachable" as const, detail: `"${bin}" not found on PATH` };
      }
      return { status: "unreachable" as const, detail: `"${bin} --version" failed` };
    }
  },
};

/** Agent.model is a free-text label like "claude-code/sonnet" — strip the prefix to get the CLI's --model value. */
export function resolveClaudeCodeModelTag(model: string): string {
  return model.replace(/^claude-code\//, "").trim();
}

interface ClaudeCodeStreamLine {
  type?: string;
  event?: { delta?: { type?: string; text?: string } };
  result?: string;
  is_error?: boolean;
}

/** Pure parsing — no I/O — so it's testable without spawning a process. */
export function extractStreamDelta(line: ClaudeCodeStreamLine): string | null {
  if (line.type === "stream_event" && line.event?.delta?.type === "text_delta") {
    return line.event.delta.text ?? null;
  }
  return null;
}

/**
 * Pure parsing — an API-level failure (bad --model value, rate limit, etc.)
 * never reaches stderr: the CLI reports it on stdout as a "result" line with
 * is_error:true and a human-readable message in `result`, then exits nonzero
 * with no other explanation. Without this, a nonzero exit with empty stderr
 * (the common case for this class of failure) surfaced as a bare "exited
 * with code 1" that gave no way to tell an invalid model from anything else.
 */
export function extractResultError(line: ClaudeCodeStreamLine): string | null {
  if (line.type === "result" && line.is_error === true && typeof line.result === "string") {
    return line.result;
  }
  return null;
}

/**
 * Streams text deltas from a real, headless Claude Code CLI turn (this
 * performs inference, unlike claudeCodeProvider.check above). Runs with
 * `--tools ""` so the CLI has no Bash/Edit/Read/etc. available at all — this
 * is meant to behave like a plain chat completion (the same contract
 * streamOllamaChat has), not an autonomous coding session against a goal
 * description it didn't write. Args go through spawn as an array (no shell),
 * so goal/agent text can't be interpreted as shell syntax. A hard timeout is
 * a defensive backstop, not a workaround for a known hang: non-interactive
 * `-p` runs silently deny any action needing approval rather than blocking on
 * one, since there's no TTY to prompt.
 */
export async function* streamClaudeCodeChat(model: string, system: string, user: string): AsyncGenerator<string> {
  const bin = getClaudeCodeBin();
  const tag = resolveClaudeCodeModelTag(model);

  const args = ["-p", user, "--output-format", "stream-json", "--include-partial-messages", "--verbose", "--tools", ""];
  if (system) args.push("--append-system-prompt", system);
  if (tag) args.push("--model", tag);

  // bin is env-driven (see getClaudeCodeBin) — turbopackIgnore keeps that dynamism from
  // making the build tracer pull the whole project into this route's server output.
  const child = spawn(/* turbopackIgnore: true */ bin, args, { stdio: ["ignore", "pipe", "pipe"] });

  try {
    await new Promise<void>((resolve, reject) => {
      child.once("spawn", resolve);
      child.once("error", reject);
    });
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
      throw new Error(
        `Claude Code CLI binary "${bin}" was not found on PATH. If it's installed, set CLAUDE_CODE_BIN ` +
          "in .env.local to its full path (see .env.local.example) and restart the dev server."
      );
    }
    throw err;
  }

  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill("SIGKILL");
  }, DISPATCH_TIMEOUT_MS);

  let stderrBuf = "";
  child.stderr?.on("data", (chunk: Buffer) => {
    stderrBuf += chunk.toString();
  });

  let emittedAny = false;
  let lastResult = "";
  let lastResultError: string | null = null;

  try {
    if (child.stdout) {
      const rl = createInterface({ input: child.stdout });
      for await (const raw of rl) {
        const line = raw.trim();
        if (!line) continue;
        let parsed: ClaudeCodeStreamLine;
        try {
          parsed = JSON.parse(line);
        } catch {
          continue;
        }
        const delta = extractStreamDelta(parsed);
        if (delta) {
          emittedAny = true;
          yield delta;
        }
        if (parsed.type === "result" && typeof parsed.result === "string") {
          lastResult = parsed.result;
        }
        lastResultError = extractResultError(parsed) ?? lastResultError;
      }
    }

    const exitCode = await new Promise<number>((resolveClose) => {
      child.once("close", (code) => resolveClose(code ?? -1));
    });

    if (exitCode !== 0) {
      if (timedOut) {
        throw new Error(`Claude Code CLI timed out after ${DISPATCH_TIMEOUT_MS / 1000}s`);
      }
      const detail = stderrBuf.trim() || lastResultError || "";
      throw new Error(`Claude Code CLI exited with code ${exitCode}${detail ? `: ${detail}` : ""}`);
    }

    if (!emittedAny && lastResult) {
      yield lastResult;
    }
  } finally {
    clearTimeout(timeout);
  }
}
