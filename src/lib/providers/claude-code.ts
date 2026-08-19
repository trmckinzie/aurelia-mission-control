import { execFile, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { promisify } from "node:util";
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
      return { status: "ready" as const, detail: version };
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
}

/** Pure parsing — no I/O — so it's testable without spawning a process. */
export function extractStreamDelta(line: ClaudeCodeStreamLine): string | null {
  if (line.type === "stream_event" && line.event?.delta?.type === "text_delta") {
    return line.event.delta.text ?? null;
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

  await new Promise<void>((resolve, reject) => {
    child.once("spawn", resolve);
    child.once("error", reject);
  });

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
      }
    }

    const exitCode = await new Promise<number>((resolveClose) => {
      child.once("close", (code) => resolveClose(code ?? -1));
    });

    if (exitCode !== 0) {
      if (timedOut) {
        throw new Error(`Claude Code CLI timed out after ${DISPATCH_TIMEOUT_MS / 1000}s`);
      }
      throw new Error(`Claude Code CLI exited with code ${exitCode}${stderrBuf.trim() ? `: ${stderrBuf.trim()}` : ""}`);
    }

    if (!emittedAny && lastResult) {
      yield lastResult;
    }
  } finally {
    clearTimeout(timeout);
  }
}
