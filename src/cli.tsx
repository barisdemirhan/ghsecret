#!/usr/bin/env node
import React from "react";
import { render } from "ink";
import meow from "meow";
import { createRequire } from "node:module";
import { App } from "./app.js";
import { printHelp } from "./components/Help.js";
import type { AppConfig } from "./utils/types.js";
import { defaultConfig } from "./utils/types.js";
import type { Target } from "./utils/gh.js";

const require = createRequire(import.meta.url);
const { version: VERSION } = require("../package.json");

const cli = meow(
  `
  Usage
    $ ghsecret -s|-v [options]
    $ ghsecret -i
    $ ghsecret push <key1> <key2> ... -s

  Options
    -s, --secret       Push as GitHub Secret(s)
    -v, --variable     Push as GitHub Variable(s)
    -i, --interactive  Interactive picker mode
    -f, --file         Env file path (default: .env)
    -a, --all          Push all keys from the file
    -k, --keys         Comma-separated keys to push
    --org              Push to organization level
    --env              Push to environment level
    --dry-run          Preview without pushing
    --force            Skip confirmation prompts
    --version          Show version
`,
  {
    importMeta: import.meta,
    autoHelp: false,
    autoVersion: false,
    flags: {
      secret: { type: "boolean", shortFlag: "s", default: false },
      variable: { type: "boolean", shortFlag: "v", default: false },
      interactive: { type: "boolean", shortFlag: "i", default: false },
      file: { type: "string", shortFlag: "f", default: ".env" },
      all: { type: "boolean", shortFlag: "a", default: false },
      keys: { type: "string", shortFlag: "k" },
      org: { type: "string" },
      env: { type: "string" },
      dryRun: { type: "boolean", default: false },
      force: { type: "boolean", default: false },
      help: { type: "boolean", shortFlag: "h", default: false },
      version: { type: "boolean", default: false },
    },
  },
);

if (cli.flags.version) {
  console.log(`ghsecret v${VERSION}`);
  process.exit(0);
}

if (cli.flags.help || (cli.input.length === 0 && !cli.flags.secret && !cli.flags.variable && !cli.flags.interactive && !cli.flags.all)) {
  printHelp(VERSION);
  process.exit(0);
}

let mode: AppConfig["mode"] = "";
if (cli.flags.secret) mode = "secret";
if (cli.flags.variable) mode = "variable";

let target: Target = "repo";
let orgName = "";
let envName = "";

if (cli.flags.org) {
  target = "org";
  orgName = cli.flags.org;
}
if (cli.flags.env) {
  target = "env";
  envName = cli.flags.env;
}

let keys: string[] = [];
if (cli.flags.keys) {
  keys = cli.flags.keys.split(",").map((k) => k.trim());
}

// Handle `ghsecret push key1 key2 ...`
if (cli.input[0] === "push") {
  keys = cli.input.slice(1);
}

const config: AppConfig = {
  ...defaultConfig,
  envFile: cli.flags.file,
  mode,
  target,
  orgName,
  envName,
  keys,
  allKeys: cli.flags.all,
  dryRun: cli.flags.dryRun,
  interactive: cli.flags.interactive,
  force: cli.flags.force,
};

const instance = render(<App config={config} />);
instance.waitUntilExit().then(() => {
  process.exit(0);
}).catch(() => {
  process.exit(1);
});
