![Built with Claude Code](https://img.shields.io/badge/Built_with-Claude_Code-D97757?logo=claude&logoColor=fff)

**English** | [Türkçe](README.tr.md)

# ghsecret

Push `.env` variables to GitHub Secrets & Variables — with smart conflict detection and precedence warnings.

```bash
# Push all .env vars as secrets
ghsecret -s -a

# Interactive mode — pick keys, choose target, decide per key
ghsecret -i
```

## Why

Managing GitHub Secrets and Variables through the web UI is slow and error-prone. `ghsecret` reads your `.env` file and pushes values directly via the GitHub CLI — with safety checks that prevent common mistakes:

- **Detects existing values** before overwriting and asks for confirmation
- **Warns about GitHub's precedence rules** (Environment > Repository > Organization) so you don't push a secret that gets silently shadowed
- **Detailed error messages** for permission issues, rate limits, and network errors
- **Dry run mode** to preview what would happen without touching anything

## Quick Start (no install)

```bash
# Interactive mode — guided step by step
npx ghsecret -i

# Push a single key as secret
npx ghsecret -s -k DB_PASSWORD

# From a specific file
npx ghsecret -s -a -f .env.production

# Push all keys as variables (dry run first)
npx ghsecret -v -a --dry-run

# Push to a specific environment
npx ghsecret -s -k API_KEY --env staging

# Push to organization
npx ghsecret -v -k SLACK_WEBHOOK --org my-org

# Push to a specific repo (skip remote selection)
npx ghsecret -s -a --repo my-org/my-repo
```

## Install

```bash
# Global install for repeated use
npm install -g ghsecret

# Or clone and link
git clone https://github.com/barisdemirhan/ghsecret.git
cd ghsecret && npm install && npm run build && npm link
```

**Requires:** [GitHub CLI (`gh`)](https://cli.github.com) authenticated via `gh auth login` and Node.js 18+.

## Usage

```
ghsecret -s|-v [options]              Push as secret or variable
ghsecret -i                           Interactive mode
ghsecret push <key1> <key2> ... -s    Push specific keys
```

### Modes

| Flag | Description |
|------|-------------|
| `-s, --secret` | Push as GitHub Secret |
| `-v, --variable` | Push as GitHub Variable |
| `-i, --interactive` | Interactive picker (choose file, target, keys, and mode) |

### Options

| Flag | Description |
|------|-------------|
| `-f, --file <path>` | Env file path (default: `.env`) |
| `-a, --all` | Push all keys from the file |
| `-k, --keys <k1,k2>` | Comma-separated keys to push |
| `--org <name>` | Push to organization level |
| `--env <name>` | Push to environment level |
| `--dry-run` | Preview without pushing |
| `--force` | Skip confirmation prompts |
| `--repo <owner/repo>` | Target specific repository (skips remote selection) |

## Examples

```bash
# Push all vars as secrets
ghsecret -s -a

# Push specific keys as variables
ghsecret -v -k APP_NAME,APP_URL,APP_ENV

# From a specific file with dry run
ghsecret -s -a -f .env.production --dry-run

# Push to staging environment
ghsecret -s -k DB_HOST,DB_PASSWORD --env staging

# Push to organization
ghsecret -v -k SLACK_WEBHOOK --org my-org

# CI/CD — no prompts
ghsecret -s -a --force

# Target a specific repo (useful with multiple remotes)
ghsecret -s -a --repo my-org/my-repo
```

## Interactive Mode

Run `ghsecret -i` for a guided experience:

```
📁 Env file path:
  › .env.production

🎯 Push target:
 ❯ 📦 Repository
   🏢 Organization
   🌍 Environment

📋 Variables in .env.production:
─────────────────────────────────────────
 ❯ ◉  APP_NAME                      = ••••••••
   ◉  APP_ENV                       = ••••••••
   ○  DB_HOST                       = ••••••••
   ◉  DB_PASSWORD                   = ••••••••
   ○  REDIS_URL                     = ••••••••

 ↑↓ navigate · space select · a toggle all · enter confirm · q quit
 3 selected

Push as:
 ❯ 🔒 Secret
   📋 Variable
   🔀 Mixed (choose per key)
```

## Remote Selection

When multiple git remotes are detected, ghsecret asks which repo to target:

```
🔗 Multiple remotes found. Push to which repo?
 ❯ origin   → barisdemirhan/ghsecret
   upstream → someorg/ghsecret
```

To skip the prompt, use `--repo`:

```bash
ghsecret -s -a --repo someorg/ghsecret
```

## Push Progress

Each key is pushed one at a time with real-time feedback:

```
 ✓ APP_NAME → 🔒 secret
 ✓ DB_HOST → 📋 variable
 ✗ BAD_KEY — Permission denied
⠋ Pushing 4/15... API_KEY → 🔒 secret
```

## Safety Features

### Conflict Detection

Before pushing, ghsecret checks if keys already exist at the target level:

```
⚠ 2 key(s) already exist at this level:
  • DB_PASSWORD (updated: 15.03.2026)
  • API_KEY (updated: 01.03.2026)
Overwrite existing values? [y/N]
```

### Precedence Warnings

GitHub resolves secrets and variables with a priority system: **Environment > Repository > Organization**. ghsecret detects when your push would be ineffective:

```
🚫 1 key(s) are shadowed by a higher-priority level:
  GitHub precedence: Environment > Repository > Organization
  • DB_PASSWORD — Repository level has the same key and will take priority
  These values will NOT be used at runtime!
Some keys will be shadowed. Continue anyway? [y/N]
```

Or when your push overrides a lower-priority level:

```
ℹ 1 key(s) will override lower-priority values:
  • DB_PASSWORD — Will override the Organization-level value
```

### Environment Auto-Create

When pushing to an environment that doesn't exist yet, ghsecret offers to create it:

```
⚠ Environment "staging" does not exist in this repository.
Create environment "staging" and continue? [y/N]
```

### Error Handling

Clear, actionable error messages instead of raw API errors:

| Scenario | Message |
|----------|---------|
| Insufficient permissions | `Permission denied. Check your token scopes and repo access.` |
| Repo/org not found | `Resource not found. Check the repo, org, or environment name.` |
| Rate limited | `Rate limited by GitHub API. Wait a moment and try again.` |
| Network issue | `Network error. Check your internet connection.` |

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Error or user cancelled |

Works correctly with `&&` chaining and CI pipelines.

## .env Format

Supports all common formats including multiline values:

```env
# Comments are skipped
APP_NAME=MyApp
APP_URL="https://example.com"
APP_KEY='base64:abc123'
export DB_HOST=localhost
INLINE=value # inline comments are stripped

# Multiline values
PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
-----END RSA PRIVATE KEY-----"
```

## Uninstall

```bash
npm uninstall -g ghsecret
```

## License

[MIT](LICENSE)
