import React, { useState } from "react";
import { useApp } from "ink";
import type { AppConfig } from "./utils/types.js";
import type { PushMode } from "./utils/gh.js";
import { parseEnvFile, type EnvEntry } from "./utils/env-parser.js";
import {
  checkDeps,
  listRemotes,
  getRepoNameFromRemote,
} from "./utils/gh.js";
import { Interactive, type InteractiveResult } from "./components/Interactive.js";
import { Push } from "./components/Push.js";
import { ErrorMessage } from "./components/ErrorMessage.js";
import { RemotePicker } from "./components/RemotePicker.js";

interface AppProps {
  config: AppConfig;
}

type Phase = "select-repo" | "interactive" | "push";

export function App({ config }: AppProps) {
  const deps = checkDeps();
  const remotes = deps.ok ? listRemotes() : [];

  // Compute initial state unconditionally (hooks must come before any returns)
  let initialRepoName = "";
  let initialPhase: Phase = "select-repo";
  let needsRemotePick = false;
  let initError = "";

  if (!deps.ok) {
    initError = deps.error!;
  } else if (config.repo) {
    initialRepoName = config.repo;
    initialPhase = config.interactive ? "interactive" : "push";
  } else if (remotes.length === 0) {
    initError = "No git remotes found. Run from a GitHub repository directory.";
  } else if (remotes.length === 1) {
    initialRepoName = getRepoNameFromRemote(remotes[0]!);
    initialPhase = config.interactive ? "interactive" : "push";
  } else {
    needsRemotePick = true;
  }

  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [repoName, setRepoName] = useState(initialRepoName);
  const [interactiveResult, setInteractiveResult] =
    useState<InteractiveResult | null>(null);

  if (initError) {
    return <ErrorMessage message={initError} />;
  }

  if (phase === "select-repo" && needsRemotePick) {
    return (
      <RemotePicker
        remotes={remotes}
        onSelect={(remote) => {
          setRepoName(getRepoNameFromRemote(remote));
          setPhase(config.interactive ? "interactive" : "push");
        }}
      />
    );
  }

  if (phase === "interactive") {
    return (
      <Interactive
        defaultEnvFile={config.envFile}
        repoName={repoName}
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
