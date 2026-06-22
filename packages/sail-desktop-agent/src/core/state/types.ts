/**
 * Unified Agent State Types
 *
 * This file defines all types used in the functional state management system.
 * Types are designed to be JSON-serializable (using Records instead of Maps,
 * arrays instead of Sets).
 */

import type { AppMetadata, Context } from "@finos/fdc3"
import type { BrowserTypes } from "@finos/fdc3"
import type { DirectoryApp } from "../app-directory/types"

// ============================================================================
// APP INSTANCE TYPES
// ============================================================================

/**
 * FDC3 App Instance connection states
 */
export enum AppInstanceState {
  PENDING = "pending", // Host pre-register before WCP5 completes (Sail extension)
  CONNECTED = "connected", // WCP5 handshake complete; instance ready for DACP
}

/**
 * Stored registration for `addContextListener` (same fields as
 * {@link BrowserTypes.AddContextListenerRequestPayload}), after normalization:
 * `null` context type becomes `"*"`; null/empty `channelId` is omitted (listen on current user channel).
 */
export type InstanceContextListener = {
  contextType: NonNullable<BrowserTypes.AddContextListenerRequestPayload["contextType"]>
  channelId?: NonNullable<BrowserTypes.AddContextListenerRequestPayload["channelId"]>
}

/**
 * Core FDC3 app instance information
 */
export interface AppInstance {
  /** Unique instance identifier */
  instanceId: string

  /** FDC3 app identifier */
  appId: string

  /** App metadata from directory */
  metadata: AppMetadata

  /** Current connection state */
  state: AppInstanceState

  /** Instance creation timestamp */
  createdAt: Date

  /** Last activity timestamp for heartbeat tracking */
  lastActivity: Date

  /** Current user channel from joinUserChannel / leave (never an app channel) */
  currentUserChannel: string | null

  /** Context listeners keyed by listener UUID */
  contextListeners: Record<string, InstanceContextListener>

  /** Array of private channel IDs this instance has access to */
  privateChannels: string[]

  /** Instance-specific metadata */
  instanceMetadata?: {
    title?: string
    hosting?: "frame" | "tab" | "window"
    parentInstanceId?: string
    [key: string]: unknown
  }
}

// ============================================================================
// INTENT TYPES
// ============================================================================

/**
 * Intent listener registration information
 */
export interface IntentListener {
  /** Unique listener identifier */
  listenerId: string

  /** Intent name being listened for */
  intentName: string

  /** Instance that registered this listener */
  instanceId: string

  /** App that owns this listener */
  appId: string

  /** Context types this listener can handle (empty = all types) */
  contextTypes: string[]

  /** Optional result type this listener produces */
  resultType?: string

  /** Registration timestamp */
  registeredAt: Date

  /** Last activity timestamp */
  lastActivity: Date

  /** Whether this listener is currently active */
  active: boolean

  /** Custom listener metadata */
  metadata?: Record<string, unknown>
}

/**
 * Pending intent - tracks intents waiting for results
 * Note: Promise functions are NOT stored in state (not serializable).
 * They are managed separately in the intent handlers.
 */
export interface PendingIntent {
  /** Original request ID */
  requestId: string

  /** Intent name */
  intentName: string

  /** Context passed to the intent */
  context: Context

  /** Source app that raised the intent */
  sourceInstanceId: string

  /** Target app handling the intent */
  targetInstanceId: string

  /** Target app ID */
  targetAppId: string

  /** When the intent was raised */
  raisedAt: Date
}

// ============================================================================
// CHANNEL TYPES
// ============================================================================

/**
 * Stored context with metadata
 */
export interface StoredContext {
  context: Context
  /** Epoch timestamp in milliseconds. */
  timestampMs: number
  /** Sequence to preserve order within the same millisecond. */
  sequence: number
  sourceInstanceId: string
}

/**
 * Private Channel metadata (internal registry representation)
 * This tracks the server-side state of a private channel
 */
export interface PrivateChannel extends BrowserTypes.Channel {
  /** Unique channel ID */
  id: string

  /** Type is always 'private' */
  type: "private"

  /** App that created the channel */
  creatorAppId: string

  /** App instance that created the channel */
  creatorInstanceId: string

  /** When the channel was created */
  createdAt: Date

  /** Array of instance IDs currently connected to this channel */
  connectedInstances: string[]

  /** Context listeners registered on this channel */
  contextListeners: Record<string, ContextListener>

  /** Event listeners for addContextListener events */
  addContextListenerListeners: Record<string, AddContextListenerListener>

  /** Event listeners for unsubscribe callbacks */
  unsubscribeListeners: Record<string, UnsubscribeListener>

  /** Disconnect listeners for onDisconnect callbacks */
  disconnectListeners: Record<string, DisconnectListener>

  /**
   * FDC3 2.2: PrivateChannel.addEventListener(null, handler) — one listener receives
   * add-context-listener, unsubscribe, and disconnect lifecycle events.
   */
  lifecycleCatchAllListeners: Record<string, AddContextListenerListener>

  /** Last context broadcast per context type */
  lastContextByType: Record<string, Context>
}

/**
 * Context listener on a private channel
 */
interface ContextListener {
  listenerId: string
  instanceId: string
  contextType: string | null // null means all types
}

/**
 * Event listener for addContextListener on private channels
 */
interface AddContextListenerListener {
  listenerId: string
  instanceId: string
}

/**
 * Unsubscribe listener for private channels
 */
interface UnsubscribeListener {
  listenerId: string
  instanceId: string
}

/**
 * Disconnect listener for private channels
 */
interface DisconnectListener {
  listenerId: string
  instanceId: string
}

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * Event listener registration
 */
export interface EventListener {
  listenerId: string
  instanceId: string
  eventType: string
}

// ============================================================================
// HEARTBEAT TYPES
// ============================================================================

/**
 * Heartbeat state for an instance
 */
export interface HeartbeatState {
  instanceId: string
  lastHeartbeatSent: number
  lastAcknowledgmentReceived: number
  missedHeartbeats: number
}

// ============================================================================
// OPEN WITH CONTEXT TYPES
// ============================================================================

/**
 * Pending open-with-context request awaiting listener registration.
 * Stored in state without timer handles so it remains serializable.
 */
export interface PendingOpenWithContext {
  message: BrowserTypes.OpenRequest
  appIdentifier: BrowserTypes.AppIdentifier
  launchContext: Context
  sourceInstanceId: string
}

// ============================================================================
// APP DIRECTORY STATE
// ============================================================================

/** Launchable app catalog — separate from runtime instances keyed by instanceId. */
export interface AppDirectoryState {
  apps: DirectoryApp[]
  directoryUrls: string[]
}

/** Pre-WCP5 DACP routing id → validated instanceId (mint and host-adopt paths). */
export interface WcpHandshakeRoutingState {
  handshakeRoutingIdToInstanceId: Record<string, string>
}

// ============================================================================
// UNIFIED AGENT STATE
// ============================================================================

/**
 * Unified agent state containing all desktop agent state
 */
export interface AgentState {
  /** All app instances keyed by instanceId */
  instances: Record<string, AppInstance>

  /** Intent-related state */
  intents: {
    /** Intent listeners keyed by listenerId */
    listeners: Record<string, IntentListener>
    /** Pending intents keyed by requestId */
    pending: Record<string, PendingIntent>
  }

  /** Channel-related state */
  channels: {
    /** User channels (pre-defined FDC3 channels) keyed by channelId */
    user: Record<string, BrowserTypes.Channel>
    /** App channels (dynamically created) keyed by channelId */
    app: Record<string, BrowserTypes.Channel>
    /** Private channels keyed by channelId */
    private: Record<string, PrivateChannel>
    /** Stored contexts: channelId -> contextType -> StoredContext */
    contexts: Record<string, Record<string, StoredContext>>
  }

  /** Event-related state */
  events: {
    /** Event listeners keyed by listenerId */
    listeners: Record<string, EventListener>
    /** Index: eventType -> listenerIds */
    byEventType: Record<string, string[]>
  }

  /** Heartbeat state keyed by instanceId */
  heartbeats: Record<string, HeartbeatState>

  /** Open request coordination state */
  open: {
    /** Pending open-with-context requests keyed by target instanceId */
    pendingWithContext: Record<string, PendingOpenWithContext[]>
  }

  /** Launchable app directory (catalog), not runtime instances */
  appDirectory: AppDirectoryState

  /** WCP4 routing id → WCP5-validated instanceId links */
  wcpHandshakeRouting: WcpHandshakeRoutingState
}

// ============================================================================
// STATE MANAGEMENT TYPES
// ============================================================================

/**
 * Function type for updating agent state.
 * Takes a transform function that receives the current state and returns the new state.
 *
 * @example
 * ```typescript
 * setState((state) => ({
 *   ...state,
 *   instances: { ...state.instances, [id]: newInstance }
 * }))
 * ```
 */
export type StateSetter = (callback: (state: AgentState) => AgentState) => void
