**English** | [Türkçe](CONTRIBUTING.tr.md)

# Contributing to ghsecret

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

```bash
git clone https://github.com/barisdemirhan/ghsecret.git
cd ghsecret
npm install
npm run build
npm link  # makes `ghsecret` available globally for testing
```

## Workflow

1. Fork the repo and create a branch from `main`
2. Make your changes in `src/`
3. Add tests for new functionality in `src/__tests__/`
4. Run checks:
   ```bash
   npm run lint    # type check
   npm test        # run tests
   npm run build   # compile
   ```
5. Test manually: `ghsecret --help`, `ghsecret -s -a --dry-run`, etc.
6. Open a PR against `main`

## Project Structure

```
src/
├── cli.tsx              # Entry point, argument parsing
├── app.tsx              # Main app component, flow control
├── components/
│   ├── Confirm.tsx      # y/N confirmation prompt
│   ├── ErrorMessage.tsx # Error display with exit code 1
│   ├── Help.tsx         # Help text output
│   ├── Interactive.tsx  # Interactive mode (file, target, keys, mode)
│   ├── MixedPicker.tsx  # Per-key secret/variable/skip chooser
│   └── Push.tsx         # Push execution with conflict/precedence checks
├── utils/
│   ├── env-parser.ts    # .env file parser
│   ├── gh.ts            # GitHub CLI wrapper functions
│   └── types.ts         # Shared types and defaults
└── __tests__/
    └── env-parser.test.ts
```

## Guidelines

- **TypeScript strict mode** — no `any`, no `@ts-ignore`
- **React + Ink** for all terminal UI — no raw `console.log` except in `Help.tsx`
- **`execFileSync`** for all `gh` CLI calls — never use `execSync` with string concatenation (shell injection risk)
- **Exit codes** — errors must exit with code 1 via `exit(new Error(...))`
- **Tests** — add tests for parser changes, test edge cases

## Reporting Bugs

Use the [bug report template](https://github.com/barisdemirhan/ghsecret/issues/new?template=bug_report.yml). Always redact secrets from logs.

## Feature Requests

Use the [feature request template](https://github.com/barisdemirhan/ghsecret/issues/new?template=feature_request.yml). Explain the problem before proposing a solution.
