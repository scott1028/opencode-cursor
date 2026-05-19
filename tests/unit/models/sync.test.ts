import { beforeEach, describe, expect, it, vi } from "bun:test";
import { autoDiscoverModels } from "../../../src/models/sync.js";

type MockDeps = Parameters<typeof autoDiscoverModels>[1];

function createDeps(overrides: MockDeps = {}) {
  const debug = vi.fn();
  const info = vi.fn();
  const discoverModels = vi.fn(() => [
    { id: "auto", name: "Auto" },
    { id: "gpt-5.4-high", name: "GPT-5.4 High" },
  ]);

  const deps = {
    discoverModels,
    log: { debug, info, warn: vi.fn(), error: vi.fn() },
    ...overrides,
  };

  return { deps, debug, info, discoverModels };
}

function createConfig(overrides: Record<string, unknown> = {}) {
  return {
    provider: {
      "cursor-acp": {
        models: {
          auto: { name: "Auto" },
        },
      },
    },
    ...overrides,
  };
}

describe("models/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds newly discovered models to runtime config without removing existing entries", () => {
    const config = createConfig({
      provider: {
        "cursor-acp": {
          models: {
            auto: { name: "Auto" },
            "custom-model": { name: "Custom" },
          },
        },
      },
    });
    const { deps } = createDeps({
      discoverModels: vi.fn(() => [
        { id: "auto", name: "Auto" },
        { id: "gpt-5.4-high", name: "GPT-5.4 High" },
        { id: "kimi-k2.5", name: "Kimi K2.5" },
      ]),
    });

    const result = autoDiscoverModels(config, deps);

    expect(result).toEqual({
      added: 2,
      discovered: 3,
      total: 4,
      status: "updated",
    });
    expect(config.provider["cursor-acp"].models).toEqual({
      auto: { name: "Auto" },
      "custom-model": { name: "Custom" },
      "gpt-5.4-high": { name: "GPT-5.4 High" },
      "kimi-k2.5": { name: "Kimi K2.5" },
    });
  });

  it("returns silently when the provider section is missing", () => {
    const { deps, discoverModels } = createDeps();

    const result = autoDiscoverModels({ provider: {} }, deps);

    expect(result).toEqual({
      added: 0,
      discovered: 0,
      total: 0,
      status: "skipped",
      reason: "missing_provider",
    });
    expect(discoverModels).not.toHaveBeenCalled();
  });

  it("returns silently when cursor-agent model discovery fails", () => {
    const config = createConfig();
    const { deps } = createDeps({
      discoverModels: vi.fn(() => {
        throw new Error("cursor-agent unavailable");
      }),
    });

    const result = autoDiscoverModels(config, deps);

    expect(result).toEqual({
      added: 0,
      discovered: 0,
      total: 1,
      status: "failed",
      reason: "discovery_failed",
    });
    expect(config.provider["cursor-acp"].models).toEqual({
      auto: { name: "Auto" },
    });
  });

  it("does not replace runtime models when no new models are discovered", () => {
    const config = createConfig();
    const existingModels = config.provider["cursor-acp"].models;
    const { deps, info } = createDeps({
      discoverModels: vi.fn(() => [{ id: "auto", name: "Auto" }]),
    });

    const result = autoDiscoverModels(config, deps);

    expect(result).toEqual({
      added: 0,
      discovered: 1,
      total: 1,
      status: "unchanged",
    });
    expect(config.provider["cursor-acp"].models).toBe(existingModels);
    expect(info).not.toHaveBeenCalled();
  });

  it("never lets unexpected failures escape", () => {
    const { deps } = createDeps();
    const config = {
      get provider() {
        throw new Error("read failed");
      },
    };

    expect(() => autoDiscoverModels(config, deps)).not.toThrow();
  });
});
