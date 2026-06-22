// ============================================================================
// SAIL PLATFORM TYPES
// ============================================================================
//
// All Sail-specific types and interfaces used by the socket server and related
// components. These types define the core Sail platform abstractions.
//
// ============================================================================

import type { AppIdentifier, AppIntent, Context } from "@finos/fdc3"

// Re-export DirectoryApp and WebAppDetails from sail-desktop-agent for consistency
export type { DirectoryApp, WebAppDetails } from "@finos/sail-desktop-agent"

// ============================================================================
// SAIL INSTANCE MANAGEMENT
// ============================================================================

/**
 * Sail-specific app connection states
 * Tracks the lifecycle of app connections to the Sail platform
 */
export enum State {
  Pending = 0, // App started but not completed FDC3 handshake
  Connected = 1, // App completed FDC3 handshake
  NotResponding = 2, // App not responding to heartbeat
  Terminated = 3, // App sent termination message
}

/**
 * Unique identifier for a specific app instance in the Sail platform
 */
export type InstanceID = string

/**
 * Sail app registration combining FDC3 app info with connection state
 * Links standard FDC3 AppIdentifier with Sail-specific instance tracking
 */
export interface AppRegistration {
  state: State
  appId: string
  instanceId: InstanceID
}

// Note: WebAppDetails and DirectoryApp are re-exported from @finos/sail-desktop-agent above

// ============================================================================
// SAIL SERVER INTERFACES
// ============================================================================

/**
 * Sail FDC3 Server interface for message handling and cleanup
 * Used by desktop agent to process FDC3 messages and manage app lifecycle
 */
export interface FDC3Server {
  receive(message: object, from: InstanceID): Promise<void>
  cleanup(instanceId: InstanceID): void
}

/**
 * Sail Server Context interface for app management and messaging
 * Provides the desktop agent with capabilities to launch apps and send messages
 */
export interface ServerContext<X extends AppRegistration = AppRegistration> {
  // Core messaging
  createUUID(): string
  post(message: object, instanceId: InstanceID): Promise<void>

  // App lifecycle
  open(appId: string): Promise<InstanceID>
  setAppState(app: InstanceID, state: State): Promise<void>

  // App registry
  setInstanceDetails(uuid: InstanceID, details: X): void
  getInstanceDetails(uuid: InstanceID): X | undefined
  getConnectedApps(): Promise<AppRegistration[]>
  getAllApps(): Promise<AppRegistration[]>
  isAppConnected(app: InstanceID): Promise<boolean>

  // FDC3 integration
  setFDC3Server(server: FDC3Server): void
  narrowIntents(
    raiser: AppIdentifier,
    appIntents: AppIntent[],
    context: Context
  ): Promise<AppIntent[]>

  // Server metadata
  log(message: string): void
  provider(): string
  providerVersion(): string
  fdc3Version(): string
}

// ============================================================================
// SAIL UI TYPES
// ============================================================================

/**
 * Tab/Channel visual representation for UI rendering
 * Used across multiple packages for channel visualization
 */
export interface TabDetail {
  id: string
  icon: string
  background: string
}

/**
 * Sail app hosting approach
 */
export enum AppHosting {
  Frame,
  Tab,
}

// ============================================================================
// SAIL MESSAGE PAYLOAD INTERFACES
// ============================================================================

/**
 * App Hello message arguments for FDC3 connection handshake
 */
export interface AppHelloArgs {
  instanceId: string
  appId: string
  userSessionId?: string
}
