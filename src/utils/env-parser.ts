import { readFileSync } from "node:fs";

export interface EnvEntry {
  key: string;
  value: string;
}

export function parseEnvFile(filePath: string): EnvEntry[] {
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
      throw new Error(`File not found: ${filePath}`);
    }
    throw err;
  }
  const entries: EnvEntry[] = [];
  const lines = content.split("\n");
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i]!.trim();
    i++;

    if (!rawLine || rawLine.startsWith("#")) continue;

    const cleaned = rawLine.replace(/^export\s+/, "");
    const eqIndex = cleaned.indexOf("=");
    if (eqIndex === -1) continue;

    const key = cleaned.slice(0, eqIndex).trim();
    if (!key || /\s/.test(key)) continue;

    let value = cleaned.slice(eqIndex + 1).trim();

    // Multiline: opening quote without closing quote on same line
    if (
      (value.startsWith('"') && !value.endsWith('"')) ||
      (value.startsWith("'") && !value.endsWith("'"))
    ) {
      const quote = value[0]!;
      const parts = [value.slice(1)];
      while (i < lines.length) {
        const nextLine = lines[i]!;
        i++;
        if (nextLine.trimEnd().endsWith(quote)) {
          parts.push(nextLine.trimEnd().slice(0, -1));
          break;
        }
        parts.push(nextLine);
      }
      value = parts.join("\n");
    } else if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      // Single-line quoted value — strip quotes, no inline comment stripping
      value = value.slice(1, -1);
    } else {
      // Unquoted value — strip inline comments
      const commentIndex = value.indexOf(" #");
      if (commentIndex !== -1) {
        value = value.slice(0, commentIndex).trimEnd();
      }
    }

    entries.push({ key, value });
  }

  return entries;
}

export function getKeys(filePath: string): string[] {
  return parseEnvFile(filePath).map((e) => e.key);
}

export function getValue(filePath: string, targetKey: string): string | null {
  const entry = parseEnvFile(filePath).find((e) => e.key === targetKey);
  return entry ? entry.value : null;
}
