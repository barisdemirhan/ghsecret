import React, { useEffect } from "react";
import { Text, useApp } from "ink";

interface ErrorMessageProps {
  message: string;
}

export function ErrorMessage({ message }: ErrorMessageProps) {
  const { exit } = useApp();

  useEffect(() => {
    exit(new Error(message));
  }, []);

  return <Text color="red">✗ {message}</Text>;
}
