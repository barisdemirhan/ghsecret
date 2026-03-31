import React, { useState } from "react";
import { Text, Box, useInput } from "ink";
import type { EnvEntry } from "../utils/env-parser.js";
import type { PushMode } from "../utils/gh.js";

export interface MixedChoice {
  key: string;
  value: string;
  mode: PushMode | "skip";
}

interface MixedPickerProps {
  entries: EnvEntry[];
  onComplete: (choices: MixedChoice[]) => void;
}

export function MixedPicker({ entries, onComplete }: MixedPickerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [choices, setChoices] = useState<MixedChoice[]>([]);

  const current = entries[currentIndex];

  useInput((input) => {
    if (!current) return;

    let mode: PushMode | "skip" | null = null;

    if (input === "s" || input === "S") mode = "secret";
    else if (input === "v" || input === "V") mode = "variable";
    else if (input === "k" || input === "K") mode = "skip";

    if (mode) {
      const newChoices = [
        ...choices,
        { key: current.key, value: current.value, mode },
      ];

      if (currentIndex + 1 >= entries.length) {
        onComplete(newChoices);
      } else {
        setChoices(newChoices);
        setCurrentIndex(currentIndex + 1);
      }
    }
  });

  if (!current) return null;

  return (
    <Box flexDirection="column">
      {choices.map((c) => (
        <Text key={c.key}>
          {c.mode === "skip" ? (
            <Text dimColor> ℹ Skipped: {c.key}</Text>
          ) : c.mode === "secret" ? (
            <Text color="green"> ✓ {c.key} → 🔒 secret</Text>
          ) : (
            <Text color="green"> ✓ {c.key} → 📋 variable</Text>
          )}
        </Text>
      ))}

      <Text>
        {"  "}
        <Text bold>{current.key}</Text>
        {"  →  "}
        [<Text color="green">s</Text>]ecret / [<Text color="blue">v</Text>
        ]ariable / [<Text dimColor>k</Text>]ip?
      </Text>
    </Box>
  );
}
