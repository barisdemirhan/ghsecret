import { execSync, execFileSync, execFile } from "node:child_process";

export type PushMode = "secret" | "variable";
export type Target = "repo" | "org" | "env";

// GitHub Actions variable name rules: alphanumeric + underscore, cannot start with a number
const VALID_KEY_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;

export interface PushOptions {
  key: string;
  value: string;
  mode: PushMode;
  target: Target;
  orgName?: string;
  envName?: string;
  repoName?: string;
}

export interface PushResult {
  key: string;
  mode: PushMode;
  success: boolean;
  existed: boolean;
  skipped: boolean;
  error?: string;
}

export interface ExistingEntry {
  name: string;
  updatedAt?: string;
}

export function isValidKey(key: string): boolean {
  return VALID_KEY_REGEX.test(key);
}

export function validateKeys(keys: string[]): string[] {
  return keys.filter((k) => !isValidKey(k));
}

export function checkDeps(): { ok: boolean; error?: string } {
  // `command -v` is a shell built-in, requires execSync
  try {
    execSync("command -v gh", { stdio: "pipe" });
  } catch {
    return {
      ok: false,
      error: "gh CLI not found. Install: https://cli.github.com",
    };
  }

  try {
    execFileSync("gh", ["auth", "status"], {
      stdio: "pipe",
      encoding: "utf-8",
    });
  } catch {
    return {
      ok: false,
      error: "Not authenticated. Run: gh auth login",
    };
  }

  return { ok: true };
}

export function getRepoName(): string {
  try {
    const result = execFileSync(
      "gh",
      ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"],
      { stdio: "pipe", encoding: "utf-8" },
    );
    return result.trim();
  } catch {
    throw new Error("Not in a GitHub repo directory");
  }
}

export function environmentExists(envName: string, repoName: string): boolean {
  try {
    execFileSync(
      "gh",
      ["api", `repos/${repoName}/environments/${envName}`],
      { stdio: "pipe" },
    );
    return true;
  } catch {
    return false;
  }
}

export function createEnvironment(envName: string, repoName: string): boolean {
  try {
    execFileSync(
      "gh",
      ["api", "--method", "PUT", `repos/${repoName}/environments/${envName}`],
      { stdio: "pipe" },
    );
    return true;
  } catch {
    return false;
  }
}

export interface RemoteInfo {
  name: string;
  owner: string;
  repo: string;
}

export function listRemotes(): RemoteInfo[] {
  try {
    const raw = execSync("git remote -v", { stdio: "pipe", encoding: "utf-8" });
    const seen = new Set<string>();
    const remotes: RemoteInfo[] = [];

    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      const parts = line.split(/\s+/);
      const name = parts[0] ?? "";
      const url = parts[1] ?? "";

      if (seen.has(name)) continue;
      seen.add(name);

      // Parse SSH: git@github.com:owner/repo.git
      // Parse HTTPS: https://github.com/owner/repo.git
      const match = url.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
      if (!match) continue;

      remotes.push({
        name,
        owner: match[1]!,
        repo: match[2]!,
      });
    }

    return remotes;
  } catch {
    return [];
  }
}

export function getRepoNameFromRemote(remote: RemoteInfo): string {
  return `${remote.owner}/${remote.repo}`;
}

export function listEnvironments(repoName: string): string[] {
  try {
    const raw = execFileSync(
      "gh",
      ["api", `repos/${repoName}/environments`, "--jq", ".environments[].name"],
      { stdio: "pipe", encoding: "utf-8" },
    );
    return raw.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

export function listExisting(
  mode: PushMode,
  target: Target,
  orgName?: string,
  envName?: string,
  repoName?: string,
): ExistingEntry[] {
  const args: string[] = [mode, "list", "--json", "name,updatedAt"];

  if (repoName) {
    args.push("-R", repoName);
  }

  if (target === "org" && orgName) {
    args.push("--org", orgName);
  } else if (target === "env" && envName) {
    args.push("--env", envName);
  }

  try {
    const raw = execFileSync("gh", args, {
      stdio: "pipe",
      encoding: "utf-8",
    });
    const parsed = JSON.parse(raw.trim() || "[]");
    return Array.isArray(parsed)
      ? parsed.map((e: { name: string; updatedAt?: string }) => ({
          name: e.name,
          updatedAt: e.updatedAt,
        }))
      : [];
  } catch {
    return [];
  }
}

// GitHub precedence: Environment > Repository > Organization
// Higher priority levels override lower ones at runtime.
export type PrecedenceLevel = "org" | "repo" | "env";

const LEVEL_PRIORITY: Record<PrecedenceLevel, number> = {
  org: 1,
  repo: 2,
  env: 3,
};

const LEVEL_LABEL: Record<PrecedenceLevel, string> = {
  org: "Organization",
  repo: "Repository",
  env: "Environment",
};

export interface PrecedenceWarning {
  key: string;
  pushingTo: PrecedenceLevel;
  existsAt: PrecedenceLevel;
  overrides: boolean;
  label: string;
}

export function getOwnerFromRepo(repoName: string): string {
  return repoName.split("/")[0] ?? "";
}

export function checkPrecedence(
  keysToCheck: string[],
  mode: PushMode,
  pushTarget: Target,
  repoName: string,
  orgName?: string,
  envName?: string,
): PrecedenceWarning[] {
  const warnings: PrecedenceWarning[] = [];
  const owner = getOwnerFromRepo(repoName);

  const levelsToScan: { level: PrecedenceLevel; list: () => ExistingEntry[] }[] = [];

  if (pushTarget === "org") {
    levelsToScan.push({
      level: "repo",
      list: () => listExisting(mode, "repo", undefined, undefined, repoName),
    });
  } else if (pushTarget === "repo") {
    if (owner) {
      levelsToScan.push({
        level: "org",
        list: () => listExisting(mode, "org", owner, undefined, repoName),
      });
    }
  } else if (pushTarget === "env") {
    levelsToScan.push({
      level: "repo",
      list: () => listExisting(mode, "repo", undefined, undefined, repoName),
    });
    if (owner) {
      levelsToScan.push({
        level: "org",
        list: () => listExisting(mode, "org", owner, undefined, repoName),
      });
    }
  }

  for (const scan of levelsToScan) {
    let existing: ExistingEntry[];
    try {
      existing = scan.list();
    } catch {
      continue;
    }

    const existingNames = new Set(existing.map((e) => e.name));
    const pushPriority = LEVEL_PRIORITY[pushTarget];
    const scanPriority = LEVEL_PRIORITY[scan.level];

    for (const key of keysToCheck) {
      if (!existingNames.has(key)) continue;

      const overrides = scanPriority > pushPriority;

      let label: string;
      if (overrides) {
        label = `${LEVEL_LABEL[scan.level]} level has the same key and will take priority`;
      } else {
        label = `Will override the ${LEVEL_LABEL[scan.level]}-level value`;
      }

      warnings.push({
        key,
        pushingTo: pushTarget,
        existsAt: scan.level,
        overrides,
        label,
      });
    }
  }

  return warnings;
}

function parseGhError(stderr: string): string {
  const lower = stderr.toLowerCase();

  if (lower.includes("http 403") || lower.includes("permission") || lower.includes("forbidden")) {
    return "Permission denied. Check your token scopes and repo access.";
  }
  if (lower.includes("http 404") || lower.includes("not found")) {
    return "Resource not found. Check the repo, org, or environment name.";
  }
  if (lower.includes("http 422")) {
    return "Validation error. The key name may contain invalid characters.";
  }
  if (lower.includes("rate limit") || lower.includes("http 429")) {
    return "Rate limited by GitHub API. Wait a moment and try again.";
  }
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return "Request timed out. Check your network connection.";
  }
  if (lower.includes("could not resolve") || lower.includes("network")) {
    return "Network error. Check your internet connection.";
  }

  return "Unexpected error. Run with --dry-run to preview.";
}

export function pushSingle(options: PushOptions): PushResult {
  const { key, value, mode, target, orgName, envName } = options;

  if (!isValidKey(key)) {
    return {
      key,
      mode,
      success: false,
      existed: false,
      skipped: false,
      error: `Invalid key name "${key}". Keys must match [A-Za-z_][A-Za-z0-9_]*`,
    };
  }

  // Flags must come before "--" sentinel; key comes after "--" (arg injection defense)
  const args: string[] =
    mode === "secret"
      ? ["secret", "set"]
      : ["variable", "set"];

  if (target === "org" && orgName) {
    args.push("--org", orgName);
  } else if (target === "env" && envName) {
    args.push("--env", envName);
  }

  if (options.repoName) {
    args.push("-R", options.repoName);
  }

  args.push("--", key);

  try {
    // Value passed via stdin — never as a CLI argument (prevents ps aux leakage)
    execFileSync("gh", args, {
      input: value,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { key, mode, success: true, existed: false, skipped: false };
  } catch (err) {
    let stderr = "";
    if (err && typeof err === "object" && "stderr" in err) {
      const buf = (err as { stderr: Buffer | string }).stderr;
      stderr = Buffer.isBuffer(buf) ? buf.toString("utf-8") : String(buf);
    }
    return {
      key,
      mode,
      success: false,
      existed: false,
      skipped: false,
      error: parseGhError(stderr),
    };
  }
}

export async function pushSingleAsync(options: PushOptions): Promise<PushResult> {
  const { key, value, mode, target, orgName, envName } = options;

  if (!isValidKey(key)) {
    return {
      key,
      mode,
      success: false,
      existed: false,
      skipped: false,
      error: `Invalid key name "${key}". Keys must match [A-Za-z_][A-Za-z0-9_]*`,
    };
  }

  const args: string[] =
    mode === "secret"
      ? ["secret", "set"]
      : ["variable", "set"];

  if (target === "org" && orgName) {
    args.push("--org", orgName);
  } else if (target === "env" && envName) {
    args.push("--env", envName);
  }

  if (options.repoName) {
    args.push("-R", options.repoName);
  }

  args.push("--", key);

  return new Promise<PushResult>((resolve) => {
    const child = execFile("gh", args, (err, _stdout, stderr) => {
      if (err) {
        const stderrStr = typeof stderr === "string" ? stderr : "";
        resolve({
          key,
          mode,
          success: false,
          existed: false,
          skipped: false,
          error: parseGhError(stderrStr),
        });
        return;
      }
      resolve({ key, mode, success: true, existed: false, skipped: false });
    });
    if (child.stdin) {
      child.stdin.write(value);
      child.stdin.end();
    }
  });
}
