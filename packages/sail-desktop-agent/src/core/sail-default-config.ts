/**
 * FDC3-Sail product defaults for Desktop Agent configuration.
 *
 * Single source of truth for implementation metadata, user channels, and timing
 * defaults. `DesktopAgent` merges these with caller overrides in its constructor.
 */

import type { BrowserTypes } from "@finos/fdc3"
import pkg from "../../package.json"
import { DACP_TIMEOUTS } from "./dacp/dacp-constants"
import type { DesktopAgentConfig, DesktopAgentOptions } from "./desktop-agent"
import { DEFAULT_FDC3_USER_CHANNELS } from "./default-user-channels"

export type SailImplementationMetadata = Pick<
  BrowserTypes.ImplementationMetadata,
  "fdc3Version" | "provider" | "providerVersion"
> &
  Pick<Required<BrowserTypes.ImplementationMetadata>, "optionalFeatures">

export const DEFAULT_SAIL_IMPLEMENTATION_METADATA: SailImplementationMetadata = {
  fdc3Version: "2.2",
  provider: "FDC3-Sail",
  providerVersion: pkg.version,
  optionalFeatures: {
    DesktopAgentBridging: false,
    OriginatingAppMetadata: true,
    UserChannelMembershipAPIs: true,
  },
}

/** Product defaults merged into every `DesktopAgent` unless overridden. */
export const DEFAULT_SAIL_DESKTOP_AGENT_CONFIG = {
  implementationMetadata: DEFAULT_SAIL_IMPLEMENTATION_METADATA,
  userChannels: DEFAULT_FDC3_USER_CHANNELS,
  logPayloadDetail: "metadata" as const,
  openContextListenerTimeoutMs: DACP_TIMEOUTS.MINIMUM_APP_LAUNCH,
  heartbeatEnabled: true,
  heartbeatIntervalMs: 30_000,
  heartbeatTimeoutMs: 60_000,
} satisfies Pick<
  DesktopAgentConfig,
  | "implementationMetadata"
  | "userChannels"
  | "logPayloadDetail"
  | "openContextListenerTimeoutMs"
  | "heartbeatEnabled"
  | "heartbeatIntervalMs"
  | "heartbeatTimeoutMs"
>

function mergeImplementationMetadata(
  base: SailImplementationMetadata,
  override?: Partial<SailImplementationMetadata>
): SailImplementationMetadata {
  if (!override) {
    return base
  }

  return {
    ...base,
    ...override,
    optionalFeatures: {
      ...base.optionalFeatures,
      ...override.optionalFeatures,
    },
  }
}

/**
 * Merge FDC3-Sail product defaults with caller options.
 * Used by `DesktopAgent` constructor; exported for tests and pre-built config.
 */
export function resolveDesktopAgentConfig(options: DesktopAgentOptions): DesktopAgentConfig {
  const { implementationMetadata, ...rest } = options

  return {
    ...DEFAULT_SAIL_DESKTOP_AGENT_CONFIG,
    ...rest,
    userChannels: rest.userChannels ?? DEFAULT_SAIL_DESKTOP_AGENT_CONFIG.userChannels,
    logPayloadDetail: rest.logPayloadDetail ?? DEFAULT_SAIL_DESKTOP_AGENT_CONFIG.logPayloadDetail,
    openContextListenerTimeoutMs:
      rest.openContextListenerTimeoutMs ??
      DEFAULT_SAIL_DESKTOP_AGENT_CONFIG.openContextListenerTimeoutMs,
    heartbeatEnabled: rest.heartbeatEnabled ?? DEFAULT_SAIL_DESKTOP_AGENT_CONFIG.heartbeatEnabled,
    heartbeatIntervalMs:
      rest.heartbeatIntervalMs ?? DEFAULT_SAIL_DESKTOP_AGENT_CONFIG.heartbeatIntervalMs,
    heartbeatTimeoutMs:
      rest.heartbeatTimeoutMs ?? DEFAULT_SAIL_DESKTOP_AGENT_CONFIG.heartbeatTimeoutMs,
    implementationMetadata: mergeImplementationMetadata(
      DEFAULT_SAIL_IMPLEMENTATION_METADATA,
      implementationMetadata
    ),
  }
}
