import { discoverModelsFromCursorAgent, type DiscoveredModel } from "../cli/model-discovery.js";
import { createLogger, type Logger } from "../utils/logger.js";

const log = createLogger("model-sync");
const PROVIDER_ID = "cursor-acp";

type ModelConfigEntry = { name: string };
type ProviderConfig = { models?: Record<string, unknown> } & Record<string, unknown>;
type OpenCodeConfig = {
  provider?: Record<string, ProviderConfig | undefined>;
} & Record<string, unknown>;
type AutoDiscoverModelsDeps = {
  discoverModels: () => DiscoveredModel[];
  log: Logger;
};

export type AutoDiscoverModelsResult = {
  added: number;
  discovered: number;
  total: number;
  status: "updated" | "unchanged" | "skipped" | "failed";
  reason?: string;
};

const defaultDeps: AutoDiscoverModelsDeps = {
  discoverModels: discoverModelsFromCursorAgent,
  log,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getProviderConfig(config: OpenCodeConfig): ProviderConfig | null {
  if (!isRecord(config.provider)) {
    return null;
  }

  const provider = config.provider[PROVIDER_ID];
  return isRecord(provider) ? (provider as ProviderConfig) : null;
}

function getExistingModels(provider: ProviderConfig): Record<string, unknown> {
  return isRecord(provider.models) ? { ...provider.models } : {};
}

/**
 * Auto-discover models into OpenCode's runtime config.
 *
 * - Queries cursor-agent for available models
 * - Merges discovered models into the in-memory provider config (additive only)
 * - Never writes opencode.json, preserving JSONC comments on disk
 *
 * This function never throws. All failures are logged at debug level and
 * silently ignored so plugin startup is never blocked.
 */
export function autoDiscoverModels(
  config: OpenCodeConfig,
  deps: Partial<AutoDiscoverModelsDeps> = {},
): AutoDiscoverModelsResult {
  const resolvedDeps: AutoDiscoverModelsDeps = {
    ...defaultDeps,
    ...deps,
  };

  try {
    const provider = getProviderConfig(config);
    if (!provider) {
      resolvedDeps.log.debug("Provider section not found in runtime config, skipping model auto-discovery");
      return { added: 0, discovered: 0, total: 0, status: "skipped", reason: "missing_provider" };
    }

    const existingModels = getExistingModels(provider);
    let discovered: DiscoveredModel[];
    try {
      discovered = resolvedDeps.discoverModels();
    } catch (err) {
      resolvedDeps.log.debug("cursor-agent model discovery failed, skipping runtime auto-discovery", {
        error: String(err),
      });
      return {
        added: 0,
        discovered: 0,
        total: Object.keys(existingModels).length,
        status: "failed",
        reason: "discovery_failed",
      };
    }

    let addedCount = 0;
    for (const model of discovered) {
      if (Object.prototype.hasOwnProperty.call(existingModels, model.id)) continue;
      existingModels[model.id] = { name: model.name } satisfies ModelConfigEntry;
      addedCount++;
    }

    if (addedCount === 0) {
      resolvedDeps.log.debug("Runtime model auto-discovery: no new models found", {
        existing: Object.keys(existingModels).length,
        discovered: discovered.length,
      });
      return {
        added: 0,
        discovered: discovered.length,
        total: Object.keys(existingModels).length,
        status: "unchanged",
      };
    }

    provider.models = existingModels;
    resolvedDeps.log.info("Runtime model auto-discovery: added new models", {
      added: addedCount,
      total: Object.keys(existingModels).length,
    });

    return {
      added: addedCount,
      discovered: discovered.length,
      total: Object.keys(existingModels).length,
      status: "updated",
    };
  } catch (err) {
    resolvedDeps.log.debug("Runtime model auto-discovery failed", { error: String(err) });
    return { added: 0, discovered: 0, total: 0, status: "failed", reason: "unexpected_error" };
  }
}
