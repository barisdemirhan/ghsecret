import { vi, describe, it, expect, beforeEach } from "vitest";
import * as childProcess from "node:child_process";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
  execFileSync: vi.fn(),
}));

const mockedExecFileSync = vi.mocked(childProcess.execFileSync);

describe("isValidKey", () => {
  it("accepts valid alphanumeric keys", async () => {
    const { isValidKey } = await import("../utils/gh.js");
    expect(isValidKey("APP_NAME")).toBe(true);
    expect(isValidKey("DB_HOST_1")).toBe(true);
    expect(isValidKey("_PRIVATE")).toBe(true);
  });

  it("rejects keys starting with a number", async () => {
    const { isValidKey } = await import("../utils/gh.js");
    expect(isValidKey("1BAD")).toBe(false);
  });

  it("rejects keys with special characters", async () => {
    const { isValidKey } = await import("../utils/gh.js");
    expect(isValidKey("APP-NAME")).toBe(false);
    expect(isValidKey("APP.NAME")).toBe(false);
    expect(isValidKey("APP NAME")).toBe(false);
  });

  it("rejects empty string", async () => {
    const { isValidKey } = await import("../utils/gh.js");
    expect(isValidKey("")).toBe(false);
  });
});

describe("pushSingle", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns success on successful push", async () => {
    mockedExecFileSync.mockReturnValue(Buffer.from(""));
    const { pushSingle } = await import("../utils/gh.js");
    const result = pushSingle({
      key: "TEST_KEY",
      value: "test-value",
      mode: "secret",
      target: "repo",
    });
    expect(result.success).toBe(true);
    expect(result.key).toBe("TEST_KEY");
  });

  it("returns permission error on 403", async () => {
    const err = new Error("gh failed") as Error & { stderr: Buffer };
    err.stderr = Buffer.from("HTTP 403 Forbidden");
    mockedExecFileSync.mockImplementation(() => {
      throw err;
    });
    const { pushSingle } = await import("../utils/gh.js");
    const result = pushSingle({
      key: "TEST_KEY",
      value: "test-value",
      mode: "secret",
      target: "repo",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Permission denied");
  });

  it("returns not found error on 404", async () => {
    const err = new Error("gh failed") as Error & { stderr: Buffer };
    err.stderr = Buffer.from("HTTP 404 Not Found");
    mockedExecFileSync.mockImplementation(() => {
      throw err;
    });
    const { pushSingle } = await import("../utils/gh.js");
    const result = pushSingle({
      key: "TEST_KEY",
      value: "test-value",
      mode: "variable",
      target: "repo",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("returns validation error on 422", async () => {
    const err = new Error("gh failed") as Error & { stderr: Buffer };
    err.stderr = Buffer.from("HTTP 422 Unprocessable Entity");
    mockedExecFileSync.mockImplementation(() => {
      throw err;
    });
    const { pushSingle } = await import("../utils/gh.js");
    const result = pushSingle({
      key: "TEST_KEY",
      value: "test-value",
      mode: "secret",
      target: "repo",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Validation error");
  });

  it("returns rate limit error on 429", async () => {
    const err = new Error("gh failed") as Error & { stderr: Buffer };
    err.stderr = Buffer.from("HTTP 429 rate limit exceeded");
    mockedExecFileSync.mockImplementation(() => {
      throw err;
    });
    const { pushSingle } = await import("../utils/gh.js");
    const result = pushSingle({
      key: "TEST_KEY",
      value: "test-value",
      mode: "secret",
      target: "repo",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Rate limited");
  });

  it("rejects invalid key without calling gh", async () => {
    const { pushSingle } = await import("../utils/gh.js");
    const result = pushSingle({
      key: "1-INVALID",
      value: "test",
      mode: "secret",
      target: "repo",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid key name");
    expect(mockedExecFileSync).not.toHaveBeenCalled();
  });

  it("passes value via stdin, not args", async () => {
    mockedExecFileSync.mockReturnValue(Buffer.from(""));
    const { pushSingle } = await import("../utils/gh.js");
    pushSingle({
      key: "MY_SECRET",
      value: "super-secret",
      mode: "secret",
      target: "repo",
    });
    const call = mockedExecFileSync.mock.calls[0]!;
    const args = call[1] as string[];
    expect(args).not.toContain("super-secret");
    const opts = call[2] as { input: string };
    expect(opts.input).toBe("super-secret");
  });

  it("builds correct args for org target", async () => {
    mockedExecFileSync.mockReturnValue(Buffer.from(""));
    const { pushSingle } = await import("../utils/gh.js");
    pushSingle({
      key: "ORG_VAR",
      value: "val",
      mode: "variable",
      target: "org",
      orgName: "my-org",
    });
    const args = mockedExecFileSync.mock.calls[0]![1] as string[];
    expect(args).toContain("--org");
    expect(args).toContain("my-org");
    expect(args).toContain("variable");
  });

  it("builds correct args for env target", async () => {
    mockedExecFileSync.mockReturnValue(Buffer.from(""));
    const { pushSingle } = await import("../utils/gh.js");
    pushSingle({
      key: "ENV_SEC",
      value: "val",
      mode: "secret",
      target: "env",
      envName: "production",
    });
    const args = mockedExecFileSync.mock.calls[0]![1] as string[];
    expect(args).toContain("--env");
    expect(args).toContain("production");
    expect(args).toContain("secret");
  });
});
