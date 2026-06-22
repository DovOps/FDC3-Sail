/**
 * Sail Platform Interfaces
 *
 * These interfaces define the contracts that UI implementations must fulfill.
 * The SailPlatform depends on these abstractions, allowing it to remain
 * UI-agnostic while still providing rich user interactions.
 *
 * Host contract types are owned by @finos/sail-desktop-agent and re-exported here.
 */

export type {
  AppLauncher,
  IntentResolver,
  IntentResolutionRequest,
  IntentResolutionResponse,
  IntentHandler,
  ChannelControl,
  ChannelSelectionRequest,
} from "@finos/sail-desktop-agent"

export type { ChannelControl as ChannelSelector } from "@finos/sail-desktop-agent"
