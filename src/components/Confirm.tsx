import React from "react";
import { Text, Box, useInput } from "ink";

interface ConfirmProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function Confirm({ message, onConfirm, onCancel }: ConfirmProps) {
  useInput((input) => {
    if (input === "y" || input === "Y") {
      onConfirm();
    } else if (input === "n" || input === "N" || input === "q") {
      onCancel();
    }
  });

  return (
    <Box>
      <Text color="yellow">{message}</Text>
      <Text> [y/N] </Text>
    </Box>
  );
}
