import type { PushMode, Target } from "./gh.js";

export interface AppConfig {
  envFile: string;
  mode: PushMode | "mixed" | "";
  target: Target;
  orgName: string;
  envName: string;
  keys: string[];
  allKeys: boolean;
  dryRun: boolean;
  interactive: boolean;
  force: boolean;
  repo: string;
}

export const defaultConfig: AppConfig = {
  envFile: ".env",
  mode: "",
  target: "repo",
  orgName: "",
  envName: "",
  keys: [],
  allKeys: false,
  dryRun: false,
  interactive: false,
  force: false,
  repo: "",
};
