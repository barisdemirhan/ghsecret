import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseEnvFile, getKeys, getValue } from "../utils/env-parser.js";

const testDir = join(tmpdir(), "ghsecret-test-" + Date.now());
const testEnvPath = join(testDir, ".env.test");
const testMultilinePath = join(testDir, ".env.multiline");
const testCommentsPath = join(testDir, ".env.comments");

const testEnvContent = `# This is a comment
APP_NAME=MyApp
APP_URL="https://example.com"
APP_KEY='base64:abc123'
export DB_HOST=localhost
DB_PASSWORD=super-secret-123
REDIS_URL=redis://localhost:6379
EMPTY_VAL=
MULTIWORD="hello world"
SPACED_KEY = trimmed_value
`;

const testMultilineContent = `SINGLE=normal
MULTI_DOUBLE="line1
line2
line3"
MULTI_SINGLE='first
second'
AFTER=works
`;

const testCommentsContent = `# Full line comment
APP_ENV=production # this is a comment
DB_HOST=localhost#notacomment
QUOTED="value # not a comment"
EMPTY=
NO_COMMENT=plain
`;

beforeAll(() => {
  mkdirSync(testDir, { recursive: true });
  writeFileSync(testEnvPath, testEnvContent);
  writeFileSync(testMultilinePath, testMultilineContent);
  writeFileSync(testCommentsPath, testCommentsContent);
});

afterAll(() => {
  try {
    unlinkSync(testEnvPath);
    unlinkSync(testMultilinePath);
    unlinkSync(testCommentsPath);
  } catch {}
});

describe("parseEnvFile", () => {
  it("parses correct number of keys", () => {
    const entries = parseEnvFile(testEnvPath);
    expect(entries).toHaveLength(9);
  });

  it("parses plain value", () => {
    const entries = parseEnvFile(testEnvPath);
    expect(entries.find((e) => e.key === "APP_NAME")?.value).toBe("MyApp");
  });

  it("strips double quotes", () => {
    const entries = parseEnvFile(testEnvPath);
    expect(entries.find((e) => e.key === "APP_URL")?.value).toBe(
      "https://example.com",
    );
  });

  it("strips single quotes", () => {
    const entries = parseEnvFile(testEnvPath);
    expect(entries.find((e) => e.key === "APP_KEY")?.value).toBe(
      "base64:abc123",
    );
  });

  it("handles export prefix", () => {
    const entries = parseEnvFile(testEnvPath);
    expect(entries.find((e) => e.key === "DB_HOST")?.value).toBe("localhost");
  });

  it("handles empty value", () => {
    const entries = parseEnvFile(testEnvPath);
    expect(entries.find((e) => e.key === "EMPTY_VAL")?.value).toBe("");
  });

  it("preserves quoted spaces", () => {
    const entries = parseEnvFile(testEnvPath);
    expect(entries.find((e) => e.key === "MULTIWORD")?.value).toBe(
      "hello world",
    );
  });

  it("throws for missing file", () => {
    expect(() => parseEnvFile("/nonexistent/.env")).toThrow("File not found");
  });
});

describe("multiline values", () => {
  it("parses multiline double-quoted value", () => {
    const entries = parseEnvFile(testMultilinePath);
    expect(entries.find((e) => e.key === "MULTI_DOUBLE")?.value).toBe(
      "line1\nline2\nline3",
    );
  });

  it("parses multiline single-quoted value", () => {
    const entries = parseEnvFile(testMultilinePath);
    expect(entries.find((e) => e.key === "MULTI_SINGLE")?.value).toBe(
      "first\nsecond",
    );
  });

  it("parses keys after multiline value", () => {
    const entries = parseEnvFile(testMultilinePath);
    expect(entries.find((e) => e.key === "AFTER")?.value).toBe("works");
  });

  it("parses single-line values alongside multiline", () => {
    const entries = parseEnvFile(testMultilinePath);
    expect(entries.find((e) => e.key === "SINGLE")?.value).toBe("normal");
  });
});

describe("inline comments", () => {
  it("strips inline comment from unquoted value", () => {
    const entries = parseEnvFile(testCommentsPath);
    expect(entries.find((e) => e.key === "APP_ENV")?.value).toBe("production");
  });

  it("does not strip # without preceding space", () => {
    const entries = parseEnvFile(testCommentsPath);
    expect(entries.find((e) => e.key === "DB_HOST")?.value).toBe(
      "localhost#notacomment",
    );
  });

  it("preserves # inside quoted values", () => {
    const entries = parseEnvFile(testCommentsPath);
    expect(entries.find((e) => e.key === "QUOTED")?.value).toBe(
      "value # not a comment",
    );
  });
});

describe("malformed input", () => {
  const malformedDir = join(tmpdir(), "ghsecret-malformed-" + Date.now());
  const malformedPath = join(malformedDir, ".env.malformed");

  const malformedContent = `GOOD_KEY=good_value
UNCLOSED="this quote never closes
LINE2=still inside the broken quote
LINE3=also inside
AFTER_KEY=should_be_parsed
`;

  beforeAll(() => {
    mkdirSync(malformedDir, { recursive: true });
    writeFileSync(malformedPath, malformedContent);
  });

  afterAll(() => {
    try { unlinkSync(malformedPath); } catch {}
  });

  it("handles unclosed quote by consuming to EOF and continuing", () => {
    const entries = parseEnvFile(malformedPath);
    expect(entries.find((e) => e.key === "GOOD_KEY")?.value).toBe("good_value");
    expect(entries.find((e) => e.key === "UNCLOSED")).toBeDefined();
  });

  it("limits multiline scan to prevent runaway parsing", () => {
    const bigMalformed = join(malformedDir, ".env.bigmalformed");
    let content = 'BEFORE=ok\nRUNAWAY="start\n';
    for (let i = 0; i < 200; i++) {
      content += `LINE_${i}=value_${i}\n`;
    }
    content += 'AFTER=should_exist\n';
    writeFileSync(bigMalformed, content);

    const entries = parseEnvFile(bigMalformed);
    expect(entries.find((e) => e.key === "BEFORE")?.value).toBe("ok");
    // With the 100-line limit, AFTER at line 203 should be found
    expect(entries.find((e) => e.key === "AFTER")).toBeDefined();

    try { unlinkSync(bigMalformed); } catch {}
  });
});

describe("getKeys", () => {
  it("lists all keys", () => {
    const keys = getKeys(testEnvPath);
    expect(keys).toContain("APP_NAME");
    expect(keys).toContain("DB_HOST");
    expect(keys).toContain("REDIS_URL");
  });
});

describe("getValue", () => {
  it("gets plain value", () => {
    expect(getValue(testEnvPath, "APP_NAME")).toBe("MyApp");
  });

  it("gets quoted value", () => {
    expect(getValue(testEnvPath, "APP_URL")).toBe("https://example.com");
  });

  it("returns null for missing key", () => {
    expect(getValue(testEnvPath, "NONEXISTENT")).toBeNull();
  });
});
