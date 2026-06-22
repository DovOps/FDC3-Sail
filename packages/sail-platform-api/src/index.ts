// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

// SailPlatform - Primary API for Sail Platform SDK
export {
  SailPlatform,
  type SailPlatformConfig,
  type WorkspacesApi,
  type LayoutsApi,
  type ConfigApi,
} from "./sail-platform"

export type {
  BrowserAppsController,
  BrowserChannelsController,
  BrowserIntentResolverController,
  AppChannelChangeEvent,
} from "@finos/sail-desktop-agent/presets"

// UI Interfaces (for implementing custom UI)
export type {
  IntentResolver,
  IntentResolutionRequest,
  IntentResolutionResponse,
  IntentHandler,
  ChannelSelector,
  ChannelSelectionRequest,
} from "./interfaces"

// ============================================================================
// TYPES
// ============================================================================

export * from "./types/sail-types"
export * from "./types/sail-messages"

// ============================================================================
// LOW-LEVEL APIs (for advanced use cases)
// ============================================================================

// Sail Browser Desktop Agent (use SailPlatform instead for most cases)
export { createSailBrowserDesktopAgent } from "./sail-browser-desktop-agent"
export type { SailBrowserDesktopAgentConfig } from "./sail-browser-desktop-agent"

// Services
export { SailAppLauncher } from "./services/app-launcher/sail-app-launcher"

// Sail Platform Client (workspaces, layouts, config)
export {
  // Platform client
  SailPlatformClient,
  LocalStorageBackend,
  type PlatformApi,
  type SailPlatformClientConfig,
  type LocalStorageBackendConfig,
  type RemoteBackendConfig,
} from "./client"

// Middleware pipeline (kept for future usage)
export { MiddlewarePipeline, type Middleware } from "./middleware/middleware"

// Browser Desktop Agent preset (re-export from @finos/sail-desktop-agent)
export {
  createBrowserDesktopAgent,
  type BrowserDesktopAgentOptions,
} from "@finos/sail-desktop-agent"

// Lower-level browser connector APIs (WCPConnector, MessagePortTransport)
export {
  WCPConnector,
  MessagePortTransport,
  type WCPConnectorOptions,
  type WCPConnectorEvents,
  type AppConnectionMetadata,
} from "@finos/sail-desktop-agent/browser"

// Core Desktop Agent types (for library consumers)
export {
  DesktopAgent,
  type DesktopAgentConfig,
  DEFAULT_SAIL_DESKTOP_AGENT_CONFIG,
  DEFAULT_SAIL_IMPLEMENTATION_METADATA,
  resolveDesktopAgentConfig,
  type SailImplementationMetadata,
  type Transport,
  type MessageHandler,
  type DisconnectHandler,
  type AppLauncher,
  type DirectoryApp,
  type WebAppDetails,
} from "@finos/sail-desktop-agent"

// Utilities
export { generateUuid } from "./utils/uuid"

// Validation utilities for downstream consumers
export {
  createZodValidator,
  zodValidator,
  strictZodValidator,
} from "./services/validation/zod-validator"
export { validateDACPMessage, safeParseDACPMessage } from "./services/validation/dacp-zod-validator"
export * from "./services/validation/dacp-schemas"
