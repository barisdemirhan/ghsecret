import React, { useState } from "react";
import { Text, Box, useInput, useApp, useStdout } from "ink";
import TextInput from "ink-text-input";
import { parseEnvFile, type EnvEntry } from "../utils/env-parser.js";
import type { PushMode, Target } from "../utils/gh.js";

type Step =
  | "select-file"
  | "select-target"
  | "input-org"
  | "input-env"
  | "select-keys"
  | "select-mode"
  | "done";

export interface InteractiveResult {
  keys: string[];
  mode: PushMode | "mixed";
  envFile: string;
  target: Target;
  orgName: string;
  envName: string;
}

interface InteractiveProps {
  defaultEnvFile: string;
  onComplete: (result: InteractiveResult) => void;
}

const VIEWPORT_PADDING = 6; // header + footer lines reserved

export function Interactive({ defaultEnvFile, onComplete }: InteractiveProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const terminalRows = stdout?.rows ?? 24;

  const [step, setStep] = useState<Step>("select-file");
  const [envFile, setEnvFile] = useState(defaultEnvFile);
  const [fileError, setFileError] = useState("");
  const [entries, setEntries] = useState<EnvEntry[]>([]);

  const [targetCursor, setTargetCursor] = useState(0);
  const [target, setTarget] = useState<Target>("repo");
  const [orgName, setOrgName] = useState("");
  const [envName, setEnvName] = useState("");

  const [cursor, setCursor] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const [modeCursor, setModeCursor] = useState(0);

  const targets: { label: string; value: Target }[] = [
    { label: "📦 Repository", value: "repo" },
    { label: "🏢 Organization", value: "org" },
    { label: "🌍 Environment", value: "env" },
  ];

  const modes: { label: string; value: PushMode | "mixed" }[] = [
    { label: "🔒 Secret", value: "secret" },
    { label: "📋 Variable", value: "variable" },
    { label: "🔀 Mixed (choose per key)", value: "mixed" },
  ];

  useInput((input, key) => {
    if (input === "q" && step !== "select-file" && step !== "input-org" && step !== "input-env") {
      exit(new Error("Aborted"));
      return;
    }

    if (step === "select-target") {
      if (key.upArrow) setTargetCursor((c) => Math.max(0, c - 1));
      else if (key.downArrow) setTargetCursor((c) => Math.min(targets.length - 1, c + 1));
      else if (key.return) {
        const chosen = targets[targetCursor]!.value;
        setTarget(chosen);
        if (chosen === "org") setStep("input-org");
        else if (chosen === "env") setStep("input-env");
        else setStep("select-keys");
      }
    } else if (step === "select-keys") {
      if (key.upArrow) setCursor((c) => Math.max(0, c - 1));
      else if (key.downArrow) setCursor((c) => Math.min(entries.length - 1, c + 1));
      else if (input === " ") {
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(cursor)) next.delete(cursor);
          else next.add(cursor);
          return next;
        });
      } else if (input === "a") {
        if (selected.size === entries.length) setSelected(new Set());
        else setSelected(new Set(entries.map((_, i) => i)));
      } else if (key.return && selected.size > 0) {
        setStep("select-mode");
      }
    } else if (step === "select-mode") {
      if (key.upArrow) setModeCursor((c) => Math.max(0, c - 1));
      else if (key.downArrow) setModeCursor((c) => Math.min(modes.length - 1, c + 1));
      else if (key.return) {
        const selectedKeys = [...selected].map((i) => entries[i]!.key);
        const selectedMode = modes[modeCursor]!.value;
        setStep("done");
        onComplete({
          keys: selectedKeys,
          mode: selectedMode,
          envFile,
          target,
          orgName,
          envName,
        });
      }
    }
  });

  const handleFileSubmit = (value: string) => {
    const file = value.trim() || defaultEnvFile;
    try {
      const parsed = parseEnvFile(file);
      if (parsed.length === 0) {
        setFileError(`No variables found in ${file}`);
        return;
      }
      setEnvFile(file);
      setEntries(parsed);
      setFileError("");
      setStep("select-target");
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Parse error");
    }
  };

  const handleOrgSubmit = (value: string) => {
    if (!value.trim()) return;
    setOrgName(value.trim());
    setStep("select-keys");
  };

  const handleEnvSubmit = (value: string) => {
    if (!value.trim()) return;
    setEnvName(value.trim());
    setStep("select-keys");
  };

  if (step === "done") return null;

  return (
    <Box flexDirection="column">
      {/* Step 1: File selection */}
      {step === "select-file" && (
        <>
          <Text bold>📁 Env file path:</Text>
          {fileError && <Text color="red">  ✗ {fileError}</Text>}
          <Box>
            <Text color="cyan">  › </Text>
            <TextInput
              value={envFile}
              onChange={setEnvFile}
              onSubmit={handleFileSubmit}
              placeholder={defaultEnvFile}
            />
          </Box>
          <Text dimColor>  enter to confirm (default: {defaultEnvFile})</Text>
        </>
      )}

      {/* Step 2: Target selection */}
      {step === "select-target" && (
        <>
          <Text bold>🎯 Push target:</Text>
          {targets.map((t, i) => (
            <Text key={t.value}>
              {targetCursor === i ? " ❯ " : "   "}
              {t.label}
            </Text>
          ))}
          <Box marginTop={1}>
            <Text dimColor>↑↓ navigate · enter confirm · q quit</Text>
          </Box>
        </>
      )}

      {/* Step 2b: Org name input */}
      {step === "input-org" && (
        <>
          <Text bold>🏢 Organization name:</Text>
          <Box>
            <Text color="cyan">  › </Text>
            <TextInput
              value={orgName}
              onChange={setOrgName}
              onSubmit={handleOrgSubmit}
            />
          </Box>
        </>
      )}

      {/* Step 2c: Env name input */}
      {step === "input-env" && (
        <>
          <Text bold>🌍 Environment name:</Text>
          <Box>
            <Text color="cyan">  › </Text>
            <TextInput
              value={envName}
              onChange={setEnvName}
              onSubmit={handleEnvSubmit}
            />
          </Box>
        </>
      )}

      {/* Step 3: Key selection (with viewport scroll) */}
      {step === "select-keys" && (() => {
        const maxVisible = Math.max(3, terminalRows - VIEWPORT_PADDING);
        const total = entries.length;
        const needsScroll = total > maxVisible;

        let viewStart = 0;
        if (needsScroll) {
          const half = Math.floor(maxVisible / 2);
          viewStart = Math.min(
            Math.max(0, cursor - half),
            total - maxVisible,
          );
        }
        const viewEnd = viewStart + (needsScroll ? maxVisible : total);
        const visible = entries.slice(viewStart, viewEnd);

        return (
          <>
            <Text bold>
              📋 Variables in <Text color="cyan">{envFile}</Text>
              {needsScroll && (
                <Text dimColor> ({cursor + 1}/{total})</Text>
              )}
              :
            </Text>
            <Text dimColor>─────────────────────────────────────────</Text>

            {viewStart > 0 && (
              <Text dimColor>   ↑ {viewStart} more above</Text>
            )}

            {visible.map((entry, vi) => {
              const i = viewStart + vi;
              const isSelected = selected.has(i);
              const isCursor = cursor === i;
              const displayVal = entry.value ? "••••••••" : "(empty)";

              return (
                <Text key={entry.key}>
                  {isCursor ? " ❯ " : "   "}
                  <Text color={isSelected ? "green" : undefined}>
                    {isSelected ? "◉" : "○"}
                  </Text>
                  {"  "}
                  <Text bold={isCursor}>{entry.key.padEnd(30)}</Text>
                  <Text dimColor>= {displayVal}</Text>
                </Text>
              );
            })}

            {viewEnd < total && (
              <Text dimColor>   ↓ {total - viewEnd} more below</Text>
            )}

            <Box marginTop={1} flexDirection="column">
              <Text dimColor>
                ↑↓ navigate · space select · a toggle all · enter confirm · q quit
              </Text>
              <Text>
                <Text color="green">{selected.size}</Text> selected
              </Text>
            </Box>
          </>
        );
      })()}

      {/* Step 4: Mode selection */}
      {step === "select-mode" && (
        <>
          <Text bold>Push as:</Text>
          {modes.map((m, i) => (
            <Text key={m.value}>
              {modeCursor === i ? " ❯ " : "   "}
              {m.label}
            </Text>
          ))}
          <Box marginTop={1}>
            <Text dimColor>↑↓ navigate · enter confirm</Text>
          </Box>
        </>
      )}
    </Box>
  );
}
