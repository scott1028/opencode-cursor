import { describe, it, expect } from "bun:test";
import { readMcpConfigs, readSubagentNames } from "../../src/mcp/config.js";

describe("readSubagentNames", () => {
  it("returns only mode:subagent agents when some exist", () => {
    const config = JSON.stringify({
      agent: {
        build: { mode: "primary", model: "openai/gpt-5" },
        codemachine: { mode: "subagent", model: "kimi/kimi-k2" },
        review: { mode: "subagent", model: "google/gemini" },
      },
    });
    expect(readSubagentNames({ configJson: config })).toEqual(["codemachine", "review"]);
  });

  it("returns all agents when none have mode:subagent", () => {
    const config = JSON.stringify({
      agent: {
        build: { mode: "primary", model: "openai/gpt-5" },
        plan: { mode: "primary", model: "zai/glm" },
      },
    });
    expect(readSubagentNames({ configJson: config })).toEqual(["build", "plan"]);
  });

  it("returns general-purpose when agent section is empty object", () => {
    const config = JSON.stringify({ agent: {} });
    expect(readSubagentNames({ configJson: config })).toEqual(["general-purpose"]);
  });

  it("returns general-purpose when agent section is absent", () => {
    const config = JSON.stringify({ mcp: {} });
    expect(readSubagentNames({ configJson: config })).toEqual(["general-purpose"]);
  });

  it("returns general-purpose when config file is unreadable", () => {
    expect(readSubagentNames({ configJson: undefined, existsSync: () => false })).toEqual(["general-purpose"]);
  });

  it("returns general-purpose when config is malformed JSON", () => {
    expect(readSubagentNames({ configJson: "{ bad json" })).toEqual(["general-purpose"]);
  });

  it("accepts JSONC with comments and trailing commas", () => {
    const config = `{
      // subagents only
      "agent": {
        "review": { "mode": "subagent", "model": "google/gemini" }, // trailing comma OK
      },
    }`;
    expect(readSubagentNames({ configJson: config })).toEqual(["review"]);
  });
});

describe("readMcpConfigs JSONC support", () => {
  it("parses comments and trailing commas in mcp section", () => {
    const config = `{
      // mcp servers
      "mcp": {
        "fs": {
          "type": "local",
          "command": ["mcp-server-fs", "--root", "/tmp"], // local server
        },
      },
    }`;
    const result = readMcpConfigs({ configJson: config });
    expect(result).toEqual([
      {
        name: "fs",
        type: "local",
        command: ["mcp-server-fs", "--root", "/tmp"],
        environment: undefined,
        timeout: undefined,
      },
    ]);
  });
});
