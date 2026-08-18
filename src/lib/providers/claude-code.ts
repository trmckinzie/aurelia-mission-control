import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ProviderCheck } from "@/lib/providers/types";

const execFileAsync = promisify(execFile);
const TIMEOUT_MS = 3000;

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
