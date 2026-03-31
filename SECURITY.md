**English** | [Türkçe](SECURITY.tr.md)

# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in ghsecret, **please do not open a public issue**.

Instead, report it privately:

1. Go to [Security Advisories](https://github.com/barisdemirhan/ghsecret/security/advisories/new)
2. Or email the maintainer directly

Please include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

You will receive a response within 48 hours. We will work with you to understand and address the issue before any public disclosure.

## Security Architecture

ghsecret handles sensitive data (secrets, API keys, tokens). The following measures are in place:

### Shell Injection Prevention

All `gh` CLI invocations use `execFileSync("gh", argsArray)` with argument arrays — never string concatenation with `execSync`. This prevents shell metacharacters in `.env` values from being interpreted.

### Process Argument Leakage Prevention

Secret values are passed to `gh secret set` via **stdin** (`input` option), not via `--body` CLI argument. This prevents values from appearing in `ps aux`, `/proc/<pid>/cmdline`, or system audit logs.

### Argument Injection Defense

- Key names are validated against `^[A-Za-z_][A-Za-z0-9_]*$` (GitHub Actions naming rules)
- A POSIX `--` sentinel is placed before the key argument, preventing keys like `--repo=evil/repo` from being interpreted as flags

### Value Masking

- Interactive mode displays `••••••••` instead of values during key selection — the mode (secret vs variable) hasn't been chosen yet at that point
- Mixed picker shows only key names, never values
- Dry-run mode masks secret values as `********`

### Supply Chain

- GitHub Actions are pinned to commit SHAs (not mutable tags)
- npm releases include `--provenance` attestation (SLSA Build Level 2)
- `package.json` `files` field excludes test files and source code from the published package

### Known Limitations

- **Memory:** Secret values are held as plain JavaScript strings. V8 does not support explicit memory zeroing — values persist until garbage collection. This is a fundamental Node.js limitation and cannot be mitigated in userland.
- **Terminal scrollback:** Even with masking, any terminal output (push results, errors) may persist in the terminal's scrollback buffer, screen recordings, or tmux/screen logs.
- **File path:** The `--file` flag accepts any path. ghsecret does not restrict file reads to the current directory — a user (or script) could point it at sensitive files like `~/.aws/credentials`.

## Scope

This policy applies to the `ghsecret` CLI tool. Vulnerabilities in dependencies should be reported to the respective projects.

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest  | Yes       |
| < Latest | No       |
