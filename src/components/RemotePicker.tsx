import React, { useState } from "react";
import { Text, Box, useInput } from "ink";
import type { RemoteInfo } from "../utils/gh.js";

interface RemotePickerProps {
  remotes: RemoteInfo[];
  onSelect: (remote: RemoteInfo) => void;
}

export function RemotePicker({ remotes, onSelect }: RemotePickerProps) {
  const [cursor, setCursor] = useState(0);

  useInput((_input, key) => {
    if (key.upArrow) setCursor((c) => Math.max(0, c - 1));
    else if (key.downArrow) setCursor((c) => Math.min(remotes.length - 1, c + 1));
    else if (key.return) {
      onSelect(remotes[cursor]!);
    }
  });

  return (
    <Box flexDirection="column">
      <Text bold>🔗 Multiple remotes found. Push to which repo?</Text>
      {remotes.map((r, i) => (
        <Text key={r.name}>
          {cursor === i ? " ❯ " : "   "}
          <Text bold={cursor === i}>{r.name.padEnd(12)}</Text>
          <Text dimColor>→ {r.owner}/{r.repo}</Text>
        </Text>
      ))}
      <Box marginTop={1}>
        <Text dimColor>↑↓ navigate · enter confirm</Text>
      </Box>
    </Box>
  );
}
