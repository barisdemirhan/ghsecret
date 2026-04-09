import React, { useState, useEffect } from "react";
import { Text, Box, useApp } from "ink";
import Spinner from "ink-spinner";
import type { EnvEntry } from "../utils/env-parser.js";
import type {
  PushMode,
  Target,
  PushResult,
  PrecedenceWarning,
} from "../utils/gh.js";
import {
  pushSingleAsync,
  listExisting,
  checkPrecedence,
  environmentExists,
  createEnvironment,
} from "../utils/gh.js";
import { Confirm } from "./Confirm.js";
import { MixedPicker, type MixedChoice } from "./MixedPicker.js";

interface PushProps {
  entries: EnvEntry[];
  keys: string[];
  mode: PushMode | "mixed";
  target: Target;
  orgName?: string;
  envName?: string;
  dryRun: boolean;
  force: boolean;
  repoName: string;
}

type Phase =
  | "checking"
  | "env-not-found"
  | "show-warnings"
  | "confirm"
  | "mixed-pick"
  | "pushing"
  | "done";

interface ConflictEntry {
  key: string;
  mode: PushMode;
  updatedAt?: string;
}

export function Push({
  entries,
  keys,
  mode,
  target,
  orgName,
  envName,
  dryRun,
  force,
  repoName,
}: PushProps) {
  const { exit } = useApp();

  const selectedEntries = entries.filter((e) => keys.includes(e.key));

  const [phase, setPhase] = useState<Phase>("checking");
  const [conflicts, setConflicts] = useState<ConflictEntry[]>([]);
  const [precedenceWarnings, setPrecedenceWarnings] = useState<
    PrecedenceWarning[]
  >([]);
  const [results, setResults] = useState<PushResult[]>([]);
  const [dryRunLines, setDryRunLines] = useState<
    {
      key: string;
      mode: PushMode;
      maskedValue: string;
      exists: boolean;
      warnings: PrecedenceWarning[];
    }[]
  >([]);
  const [mixedChoices, setMixedChoices] = useState<MixedChoice[]>([]);
  const [pushingIndex, setPushingIndex] = useState(-1);
  const [entriesToPush, setEntriesToPush] = useState<
    { key: string; value: string; pushMode: PushMode }[]
  >([]);

  // Step 1: Check environment exists + existing + precedence
  useEffect(() => {
    if (phase !== "checking") return;

    // Check if target environment exists
    if (target === "env" && envName && !environmentExists(envName, repoName)) {
      setPhase("env-not-found");
      return;
    }

    if (mode === "mixed") {
      setPhase("mixed-pick");
      return;
    }

    // Check same-level conflicts
    const existing = listExisting(mode, target, orgName, envName, repoName);
    const existingNames = new Set(existing.map((e) => e.name));
    const found: ConflictEntry[] = [];
    for (const key of keys) {
      if (existingNames.has(key)) {
        const match = existing.find((e) => e.name === key);
        found.push({ key, mode, updatedAt: match?.updatedAt });
      }
    }
    setConflicts(found);

    // Check cross-level precedence
    const pWarnings = checkPrecedence(
      keys,
      mode,
      target,
      repoName,
      orgName,
      envName,
    );
    setPrecedenceWarnings(pWarnings);

    const hasWarnings = found.length > 0 || pWarnings.length > 0;

    if (hasWarnings && !force && !dryRun) {
      setPhase("show-warnings");
    } else if (dryRun) {
      setPhase("pushing");
    } else if (force) {
      setPhase("pushing");
    } else {
      setPhase("confirm");
    }
  }, [phase]);

  // Execute push
  useEffect(() => {
    if (phase !== "pushing") return;

    const localEntries: { key: string; value: string; pushMode: PushMode }[] = [];

    if (mode === "mixed") {
      for (const choice of mixedChoices) {
        if (choice.mode !== "skip") {
          localEntries.push({
            key: choice.key,
            value: choice.value,
            pushMode: choice.mode,
          });
        }
      }
    } else {
      for (const entry of selectedEntries) {
        localEntries.push({
          key: entry.key,
          value: entry.value,
          pushMode: mode,
        });
      }
    }

    setEntriesToPush(localEntries);

    if (dryRun) {
      // For dry-run, fetch precedence per mode used in mixed
      let allPWarnings: PrecedenceWarning[];
      if (mode !== "mixed") {
        allPWarnings = precedenceWarnings;
      } else {
        const modeGroups = new Map<PushMode, string[]>();
        for (const e of localEntries) {
          const group = modeGroups.get(e.pushMode) ?? [];
          group.push(e.key);
          modeGroups.set(e.pushMode, group);
        }
        allPWarnings = [];
        for (const [pushMode, groupKeys] of modeGroups) {
          allPWarnings.push(
            ...checkPrecedence(groupKeys, pushMode, target, repoName, orgName, envName),
          );
        }
      }

      const existingSet = new Set<string>();
      if (mode !== "mixed") {
        const existingSame = listExisting(mode, target, orgName, envName, repoName);
        for (const e of existingSame) existingSet.add(e.name);
      } else {
        const modes = new Set(localEntries.map((e) => e.pushMode));
        for (const m of modes) {
          const existing = listExisting(m, target, orgName, envName, repoName);
          for (const e of existing) existingSet.add(e.name);
        }
      }

      const lines = localEntries.map((e) => {
        let maskedValue: string;
        if (e.pushMode === "secret") {
          maskedValue = "********";
        } else if (e.value.length > 30) {
          maskedValue = e.value.slice(0, 27) + "...";
        } else {
          maskedValue = e.value;
        }
        return {
          key: e.key,
          mode: e.pushMode,
          maskedValue,
          exists: existingSet.has(e.key),
          warnings: allPWarnings.filter((w) => w.key === e.key),
        };
      });
      setDryRunLines(lines);
      setPhase("done");
      return;
    }

    // Async push with progress
    async function run() {
      const pushResults: PushResult[] = [];
      for (let idx = 0; idx < localEntries.length; idx++) {
        setPushingIndex(idx);
        const entry = localEntries[idx]!;
        const existed = conflicts.some((c) => c.key === entry.key);
        const result = await pushSingleAsync({
          key: entry.key,
          value: entry.value,
          mode: entry.pushMode,
          target,
          orgName,
          envName,
          repoName,
        });
        result.existed = existed;
        pushResults.push(result);
        setResults([...pushResults]);
      }

      setPushingIndex(-1);
      setPhase("done");

      const failed = pushResults.filter((r) => !r.success).length;
      if (failed > 0) {
        setTimeout(() => exit(new Error(`${failed} key(s) failed to push`)), 0);
      }
    }
    run();
  }, [phase]);

  const targetLabel =
    target === "org"
      ? `org:${orgName}`
      : target === "env"
        ? `env:${envName}`
        : repoName;

  const shadowedWarnings = precedenceWarnings.filter((w) => w.overrides);
  const overrideWarnings = precedenceWarnings.filter((w) => !w.overrides);

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box flexDirection="column" marginBottom={1}>
        <Text>
          <Text bold>🚀 ghsecret</Text> → <Text color="cyan">{targetLabel}</Text>
        </Text>
        <Text dimColor>
          {" "}
          Keys: {keys.length} · Mode:{" "}
          {mode === "mixed"
            ? "mixed"
            : mode === "secret"
              ? "🔒 secret"
              : "📋 variable"}
        </Text>
        <Text dimColor>─────────────────────────────────────────</Text>
      </Box>

      {/* Checking */}
      {phase === "checking" && (
        <Text dimColor>⏳ Checking existing values on GitHub...</Text>
      )}

      {/* Environment not found */}
      {phase === "env-not-found" && (
        <Box flexDirection="column">
          <Text color="yellow">
            ⚠ Environment <Text bold>"{envName}"</Text> does not exist in this repository.
          </Text>
          <Confirm
            message={`Create environment "${envName}" and continue?`}
            onConfirm={() => {
              const created = createEnvironment(envName!, repoName);
              if (created) {
                setPhase("checking");
              } else {
                exit(new Error(`Failed to create environment "${envName}"`));
              }
            }}
            onCancel={() => exit(new Error("Aborted"))}
          />
        </Box>
      )}

      {/* Warnings: conflicts + precedence */}
      {phase === "show-warnings" && (
        <Box flexDirection="column">
          {/* Same-level overwrites */}
          {conflicts.length > 0 && (
            <Box flexDirection="column" marginBottom={1}>
              <Text color="yellow" bold>
                ⚠ {conflicts.length} key(s) already exist at this level:
              </Text>
              {conflicts.map((c) => (
                <Text key={c.key}>
                  {"  "}
                  <Text color="yellow">• {c.key}</Text>
                  {c.updatedAt && (
                    <Text dimColor>
                      {" "}
                      (updated:{" "}
                      {new Date(c.updatedAt).toLocaleDateString("tr-TR")})
                    </Text>
                  )}
                  <Text dimColor> — will be overwritten</Text>
                </Text>
              ))}
            </Box>
          )}

          {/* Shadowed: higher-priority level has same key */}
          {shadowedWarnings.length > 0 && (
            <Box flexDirection="column" marginBottom={1}>
              <Text color="red" bold>
                🚫 {shadowedWarnings.length} key(s) are shadowed by a
                higher-priority level:
              </Text>
              <Text dimColor>
                {"  "}GitHub precedence: Environment {">"} Repository {">"}{" "}
                Organization
              </Text>
              {shadowedWarnings.map((w) => (
                <Text key={`${w.key}-${w.existsAt}`}>
                  {"  "}
                  <Text color="red">• {w.key}</Text>
                  <Text> — {w.label}</Text>
                </Text>
              ))}
              <Text color="red" dimColor>
                {"  "}These values will NOT be used at runtime!
              </Text>
            </Box>
          )}

          {/* Override: pushing to higher level will shadow lower */}
          {overrideWarnings.length > 0 && (
            <Box flexDirection="column" marginBottom={1}>
              <Text color="blue" bold>
                ℹ {overrideWarnings.length} key(s) will override
                lower-priority values:
              </Text>
              {overrideWarnings.map((w) => (
                <Text key={`${w.key}-${w.existsAt}`}>
                  {"  "}
                  <Text color="blue">• {w.key}</Text>
                  <Text> — {w.label}</Text>
                </Text>
              ))}
            </Box>
          )}

          <Confirm
            message={
              shadowedWarnings.length > 0
                ? "Some keys will be shadowed. Continue anyway?"
                : "Continue?"
            }
            onConfirm={() => setPhase("pushing")}
            onCancel={() => exit(new Error("Aborted"))}
          />
        </Box>
      )}

      {/* Confirm (no warnings) */}
      {phase === "confirm" && (
        <Confirm
          message="Push to GitHub? Continue?"
          onConfirm={() => {
            if (mode === "mixed") setPhase("mixed-pick");
            else setPhase("pushing");
          }}
          onCancel={() => exit(new Error("Aborted"))}
        />
      )}

      {/* Mixed picker */}
      {phase === "mixed-pick" && (
        <MixedPicker
          entries={selectedEntries}
          onComplete={(choices) => {
            setMixedChoices(choices);
            setPhase("pushing");
          }}
        />
      )}

      {/* Push progress — completed results + active spinner */}
      {phase === "pushing" && (
        <Box flexDirection="column">
          {results.map((r) => (
            <Text key={r.key}>
              {r.success ? (
                <>
                  <Text color="green"> ✓ </Text>
                  {r.key} →{" "}
                  {r.mode === "secret" ? "🔒 secret" : "📋 variable"}
                  {r.existed && <Text color="yellow"> (overwritten)</Text>}
                </>
              ) : (
                <>
                  <Text color="red"> ✗ </Text>
                  {r.key}
                  <Text color="red"> — {r.error}</Text>
                </>
              )}
            </Text>
          ))}
          {pushingIndex >= 0 && pushingIndex < entriesToPush.length && (
            <Text>
              {"  "}
              <Spinner type="dots" />
              {" "}Pushing {pushingIndex + 1}/{entriesToPush.length}...{" "}
              {entriesToPush[pushingIndex]!.key} →{" "}
              {entriesToPush[pushingIndex]!.pushMode === "secret" ? "🔒" : "📋"}
            </Text>
          )}
        </Box>
      )}

      {/* Dry run results */}
      {phase === "done" && dryRun && (
        <Box flexDirection="column">
          {dryRunLines.map((line) => (
            <Box key={line.key} flexDirection="column">
              <Text>
                <Text dimColor> [DRY-RUN]</Text> gh {line.mode} set {line.key}{" "}
                <Text dimColor>← {line.maskedValue}</Text>
                {line.exists && <Text color="yellow"> (overwrite)</Text>}
              </Text>
              {line.warnings.map((w) => (
                <Text key={`${w.key}-${w.existsAt}`} dimColor>
                  {"           "}
                  {w.overrides ? "🚫" : "ℹ"} {w.label}
                </Text>
              ))}
            </Box>
          ))}
          <Text dimColor>─────────────────────────────────────────</Text>
          <Text color="blue">
            ℹ Dry run complete.{" "}
            <Text bold>{dryRunLines.length}</Text> key(s) previewed.
          </Text>
          {dryRunLines.filter((l) => l.exists).length > 0 && (
            <Text color="yellow">
              {"  "}⚠ {dryRunLines.filter((l) => l.exists).length} would be
              overwritten
            </Text>
          )}
          {dryRunLines.filter((l) => l.warnings.some((w) => w.overrides))
            .length > 0 && (
            <Text color="red">
              {"  "}🚫{" "}
              {
                dryRunLines.filter((l) =>
                  l.warnings.some((w) => w.overrides),
                ).length
              }{" "}
              would be shadowed by higher-priority level
            </Text>
          )}
        </Box>
      )}

      {/* Push results */}
      {phase === "done" && !dryRun && (
        <Box flexDirection="column">
          {results.map((r) => {
            const keyWarnings = precedenceWarnings.filter(
              (w) => w.key === r.key,
            );
            return (
              <Box key={r.key} flexDirection="column">
                {r.success ? (
                  <Text>
                    <Text color="green"> ✓ </Text>
                    {r.key} →{" "}
                    {r.mode === "secret" ? "🔒 secret" : "📋 variable"}
                    {r.existed && <Text color="yellow"> (overwritten)</Text>}
                  </Text>
                ) : (
                  <Text>
                    <Text color="red"> ✗ </Text>
                    {r.key}
                    <Text color="red"> — {r.error}</Text>
                  </Text>
                )}
                {r.success &&
                  keyWarnings.map((w) => (
                    <Text
                      key={`${w.key}-${w.existsAt}`}
                      color={w.overrides ? "red" : "blue"}
                    >
                      {"     "}
                      {w.overrides ? "🚫" : "ℹ"} {w.label}
                    </Text>
                  ))}
              </Box>
            );
          })}
          <Text dimColor>─────────────────────────────────────────</Text>
          {results.filter((r) => !r.success).length > 0 ? (
            <Text color="yellow">
              ⚠ {results.filter((r) => r.success).length} pushed,{" "}
              {results.filter((r) => !r.success).length} failed out of{" "}
              {results.length}
            </Text>
          ) : (
            <Text color="green">
              ✓ Done! {results.length} pushed
              {results.filter((r) => r.existed).length > 0 &&
                ` (${results.filter((r) => r.existed).length} overwritten)`}
            </Text>
          )}
          {shadowedWarnings.length > 0 && (
            <Text color="red">
              🚫 Warning: {shadowedWarnings.length} key(s) will not take effect
              — shadowed by higher-priority level
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
}
