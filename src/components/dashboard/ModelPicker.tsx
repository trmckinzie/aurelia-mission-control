"use client";

import { useState } from "react";
import type { ModelOptionGroup } from "@/lib/providers/catalog";

const CUSTOM_MODEL_VALUE = "__custom__";

interface ModelPickerProps {
  value: string;
  onChange: (value: string) => void;
  groups: ModelOptionGroup[];
  className: string;
}

/**
 * A grouped model dropdown with a "Custom…" escape hatch — the same pattern
 * ProjectDetail's task editor and FleetList's orchestrator picker already
 * use, pulled out so AgentRegistry (where agents are actually created) can
 * share it instead of using a bare free-text input. Picking from a list of
 * models that are known to exist prevents the class of typo that made
 * "claude-code/sonnet 5" a silently-broken agent.
 */
export function ModelPicker({ value, onChange, groups, className }: ModelPickerProps) {
  const allValues = groups.flatMap((g) => g.options.map((o) => o.value));
  const isKnown = allValues.includes(value);
  const [forceCustom, setForceCustom] = useState(false);
  const showCustom = forceCustom || (value.trim().length > 0 && !isKnown) || allValues.length === 0;

  if (showCustom) {
    return (
      <div className="flex flex-col gap-1">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. ollama/llama3.1 or claude-code/sonnet"
          className={`${className} font-mono`}
        />
        {allValues.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setForceCustom(false);
              onChange(allValues[0]);
            }}
            className="self-start text-[11px] text-[var(--primary)] hover:underline"
          >
            Choose from list instead
          </button>
        )}
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === CUSTOM_MODEL_VALUE) {
          setForceCustom(true);
        } else {
          onChange(e.target.value);
        }
      }}
      className={`${className} font-mono`}
    >
      {!isKnown && <option value={value}>{value || "Select a model…"}</option>}
      {groups.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </optgroup>
      ))}
      <option value={CUSTOM_MODEL_VALUE}>Custom…</option>
    </select>
  );
}
