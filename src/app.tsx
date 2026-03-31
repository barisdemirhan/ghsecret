import React, { useState } from "react";
import { useApp } from "ink";
import type { AppConfig } from "./utils/types.js";
import type { PushMode } from "./utils/gh.js";
import { parseEnvFile, type EnvEntry } from "./utils/env-parser.js";
import { checkDeps, getRepoName } from "./utils/gh.js";
import { Interactive, type InteractiveResult } from "./components/Interactive.js";
import { Push } from "./components/Push.js";
import { ErrorMessage } from "./components/ErrorMessage.js";

interface AppProps {
  config: AppConfig;
}

type Phase = "interactive" | "push";

export function App({ config }: AppProps) {
  const [phase, setPhase] = useState<Phase>(() =>
    config.interactive ? "interactive" : "push",
  );
  const [interactiveResult, setInteractiveResult] =
    useState<InteractiveResult | null>(null);

  const deps = checkDeps();
  if (!deps.ok) {
    return <ErrorMessage message={deps.error!} />;
  }

  let repoName: string;
  try {
    repoName = getRepoName();
  } catch (err) {
    return (
      <ErrorMessage
        message={
          err instanceof Error ? err.message : "Failed to get repo name"
        }
      />
    );
  }

  if (phase === "interactive") {
    return (
      <Interactive
        defaultEnvFile={config.envFile}
        onComplete={(result) => {
          setInteractiveResult(result);
          setPhase("push");
        }}
      />
    );
  }

  const envFile = interactiveResult?.envFile ?? config.envFile;
  const mode = interactiveResult?.mode ?? config.mode;
  const target = interactiveResult?.target ?? config.target;
  const orgName = interactiveResult?.orgName ?? config.orgName;
  const envName = interactiveResult?.envName ?? config.envName;

  if (!mode) {
    return (
      <ErrorMessage message="Specify mode: -s (secret), -v (variable), or -i (interactive)" />
    );
  }

  let entries: EnvEntry[];
  try {
    entries = parseEnvFile(envFile);
  } catch (err) {
    return (
      <ErrorMessage
        message={
          err instanceof Error ? err.message : "Failed to parse env file"
        }
      />
    );
  }

  let finalKeys = interactiveResult?.keys ?? config.keys;
  if (config.allKeys) {
    finalKeys = entries.map((e) => e.key);
  }

  if (finalKeys.length === 0) {
    return (
      <ErrorMessage message="No keys specified. Use -a for all, -k for specific keys, or -i for interactive." />
    );
  }

  return (
    <Push
      entries={entries}
      keys={finalKeys}
      mode={mode as PushMode | "mixed"}
      target={target}
      orgName={orgName}
      envName={envName}
      dryRun={config.dryRun}
      force={config.force}
      repoName={repoName}
    />
  );
}
