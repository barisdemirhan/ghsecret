import { vi, describe, it, expect, beforeEach } from "vitest";
import * as childProcess from "node:child_process";
import { execFile } from "node:child_process";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
  execFileSync: vi.fn(),
  execFile: vi.fn(),
}));

const mockedExecFileSync = vi.mocked(childProcess.execFileSync);
const mockedExecSync = vi.mocked(childProcess.execSync);
const mockedExecFile = vi.mocked(execFile);

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

describe("validateKeys", () => {
  it("returns empty array for all valid keys", async () => {
    const { validateKeys } = await import("../utils/gh.js");
    expect(validateKeys(["APP_NAME", "DB_HOST", "_PRIVATE"])).toEqual([]);
  });

  it("returns invalid keys", async () => {
    const { validateKeys } = await import("../utils/gh.js");
    const invalid = validateKeys(["GOOD", "1BAD", "ALSO-BAD", "OK_TOO"]);
    expect(invalid).toEqual(["1BAD", "ALSO-BAD"]);
  });

  it("returns empty for empty input", async () => {
    const { validateKeys } = await import("../utils/gh.js");
    expect(validateKeys([])).toEqual([]);
  });
});

describe("getOwnerFromRepo", () => {
  it("extracts owner from owner/repo format", async () => {
    const { getOwnerFromRepo } = await import("../utils/gh.js");
    expect(getOwnerFromRepo("barisdemirhan/ghsecret")).toBe("barisdemirhan");
  });

  it("returns full string for repo without slash", async () => {
    const { getOwnerFromRepo } = await import("../utils/gh.js");
    expect(getOwnerFromRepo("just-a-repo")).toBe("just-a-repo");
  });

  it("handles empty string", async () => {
    const { getOwnerFromRepo } = await import("../utils/gh.js");
    expect(getOwnerFromRepo("")).toBe("");
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

describe("listRemotes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("parses single remote", async () => {
    mockedExecSync.mockReturnValue(
      "origin\tgit@github.com:barisdemirhan/ghsecret.git (fetch)\n" +
      "origin\tgit@github.com:barisdemirhan/ghsecret.git (push)\n"
    );
    const { listRemotes } = await import("../utils/gh.js");
    const remotes = listRemotes();
    expect(remotes).toHaveLength(1);
    expect(remotes[0]!.name).toBe("origin");
    expect(remotes[0]!.owner).toBe("barisdemirhan");
    expect(remotes[0]!.repo).toBe("ghsecret");
  });

  it("parses multiple remotes and deduplicates", async () => {
    mockedExecSync.mockReturnValue(
      "origin\tgit@github.com:barisdemirhan/ghsecret.git (fetch)\n" +
      "origin\tgit@github.com:barisdemirhan/ghsecret.git (push)\n" +
      "upstream\thttps://github.com/someorg/ghsecret.git (fetch)\n" +
      "upstream\thttps://github.com/someorg/ghsecret.git (push)\n"
    );
    const { listRemotes } = await import("../utils/gh.js");
    const remotes = listRemotes();
    expect(remotes).toHaveLength(2);
    expect(remotes[0]!.name).toBe("origin");
    expect(remotes[1]!.name).toBe("upstream");
    expect(remotes[1]!.owner).toBe("someorg");
  });

  it("parses HTTPS remote URLs", async () => {
    mockedExecSync.mockReturnValue(
      "origin\thttps://github.com/user/repo.git (fetch)\n" +
      "origin\thttps://github.com/user/repo.git (push)\n"
    );
    const { listRemotes } = await import("../utils/gh.js");
    const remotes = listRemotes();
    expect(remotes[0]!.owner).toBe("user");
    expect(remotes[0]!.repo).toBe("repo");
  });

  it("returns empty array when no remotes", async () => {
    mockedExecSync.mockReturnValue("");
    const { listRemotes } = await import("../utils/gh.js");
    expect(listRemotes()).toEqual([]);
  });

  it("returns empty array on error", async () => {
    mockedExecSync.mockImplementation(() => { throw new Error("not a git repo"); });
    const { listRemotes } = await import("../utils/gh.js");
    expect(listRemotes()).toEqual([]);
  });
});

describe("getRepoNameFromRemote", () => {
  it("returns owner/repo format", async () => {
    const { getRepoNameFromRemote } = await import("../utils/gh.js");
    const result = getRepoNameFromRemote({ name: "origin", owner: "barisdemirhan", repo: "ghsecret" });
    expect(result).toBe("barisdemirhan/ghsecret");
  });
});

describe("pushSingleAsync", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns success on successful push", async () => {
    mockedExecFile.mockImplementation((_cmd: any, _args: any, cb: any) => {
      cb(null, "", "");
      return {} as any;
    });
    const { pushSingleAsync } = await import("../utils/gh.js");
    const result = await pushSingleAsync({
      key: "TEST_KEY",
      value: "test-value",
      mode: "secret",
      target: "repo",
    });
    expect(result.success).toBe(true);
    expect(result.key).toBe("TEST_KEY");
  });

  it("returns permission error on 403", async () => {
    const err = new Error("gh failed");
    mockedExecFile.mockImplementation((_cmd: any, _args: any, cb: any) => {
      cb(err, "", "HTTP 403 Forbidden");
      return {} as any;
    });
    const { pushSingleAsync } = await import("../utils/gh.js");
    const result = await pushSingleAsync({
      key: "TEST_KEY",
      value: "test-value",
      mode: "secret",
      target: "repo",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Permission denied");
  });

  it("rejects invalid key without calling gh", async () => {
    const { pushSingleAsync } = await import("../utils/gh.js");
    const result = await pushSingleAsync({
      key: "1-INVALID",
      value: "test",
      mode: "secret",
      target: "repo",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid key name");
    expect(mockedExecFile).not.toHaveBeenCalled();
  });

  it("passes value via stdin not args", async () => {
    const mockStdin = { write: vi.fn(), end: vi.fn() };
    mockedExecFile.mockImplementation((_cmd: any, _args: any, cb: any) => {
      cb(null, "", "");
      return { stdin: mockStdin } as any;
    });
    const { pushSingleAsync } = await import("../utils/gh.js");
    await pushSingleAsync({
      key: "MY_SECRET",
      value: "super-secret",
      mode: "secret",
      target: "repo",
    });
    const call = mockedExecFile.mock.calls[0]!;
    const args = call[1] as string[];
    expect(args).not.toContain("super-secret");
    expect(mockStdin.write).toHaveBeenCalledWith("super-secret");
  });
});
