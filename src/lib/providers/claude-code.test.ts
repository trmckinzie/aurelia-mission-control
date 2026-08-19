import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { extractStreamDelta, resolveClaudeCodeModelTag } from "@/lib/providers/claude-code";

describe("resolveClaudeCodeModelTag", () => {
  test("strips the claude-code/ prefix", () => {
    assert.equal(resolveClaudeCodeModelTag("claude-code/sonnet"), "sonnet");
  });

  test("passes through a bare model id unchanged", () => {
    assert.equal(resolveClaudeCodeModelTag("claude-sonnet-5"), "claude-sonnet-5");
  });

  test("trims surrounding whitespace", () => {
    assert.equal(resolveClaudeCodeModelTag("claude-code/ sonnet "), "sonnet");
  });
});

describe("extractStreamDelta", () => {
  test("extracts text from a stream_event text_delta line", () => {
    const line = { type: "stream_event", event: { delta: { type: "text_delta", text: "hello" } } };
    assert.equal(extractStreamDelta(line), "hello");
  });

  test("ignores non-text_delta stream_event lines", () => {
    const line = { type: "stream_event", event: { delta: { type: "input_json_delta", text: "ignored" } } };
    assert.equal(extractStreamDelta(line), null);
  });

  test("ignores system/init lines", () => {
    assert.equal(extractStreamDelta({ type: "system" }), null);
  });

  test("ignores result lines", () => {
    assert.equal(extractStreamDelta({ type: "result", result: "full text" }), null);
  });
});
