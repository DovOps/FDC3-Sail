/**
 * Sail Platform Message Types
 * Type definitions for Sail platform communication
 */

import type { Context, AppIntent, IntentMetadata, AppMetadata } from "@finos/fdc3"
import type { AppRegistration, DirectoryApp, TabDetail, AppHosting } from "./sail-types"
// ============================================================================
// SAIL MESSAGE TYPES
// ============================================================================

export type SailMessageType =
  | "daHello"
  | "sailClientState"
  | "appHello"
  | "daRegisterAppLaunch"
  | "daDirectoryListing"
  | "sailAppOpen"
  | "sailAppState"
  | "sailIntentResolve"
  | "sailIntentResolveOnChannel"
  | "sailChannelSetup"
  | "sailChannelChange"
  | "channelReceiverHello"
  | "channelReceiverUpdate"
  | "sailBroadcastContext"
  | "sail_event"
  | "fdc3_event"

export type SailHandshakeMessage = "daHello" | "sailClientState" | "appHello"

export type SailAppMessage = "sailAppOpen" | "sailAppState"

export type SailChannelMessage = "sailChannelSetup" | "sailChannelChange"

// ============================================================================
// SAIL MESSAGE PAYLOAD TYPES
// ============================================================================

// Handshake Types
export interface DesktopAgentHelloPayload<T = unknown> {
  directories: string[]
  channels: TabDetail[]
  panels: T[]
  customApps: DirectoryApp[]
  contextHistory: { [id: string]: Context[] }
}

export interface SailClientStatePayload<T = unknown> extends DesktopAgentHelloPayload<T> {
  type: SailMessageType
}

export interface AppHelloPayload {
  instanceId: string
  appId: string
  userSessionId?: string
}

// App Management Types
export interface DesktopAgentRegisterAppLaunchPayload {
  appId: string
  hosting: AppHosting
  channel: string | null
  instanceTitle: string
}

export interface DesktopAgentDirectoryListingPayload {
  // Empty payload - request for directory listing
  type: SailMessageType
}

export interface SailAppOpenPayload {
  appDRecord: DirectoryApp
  channel: string | null
  approach: AppHosting
}

export interface SailAppOpenResponsePayload {
  instanceId: string
  instanceTitle: string
}

export interface SailAppStatePayload {
  registrations: AppRegistration[]
}

// Intent Resolution Types
export interface AugmentedAppMetadata extends AppMetadata {
  channelData: TabDetail | null
  instanceTitle?: string
}

export interface AugmentedAppIntent {
  intent: IntentMetadata
  apps: AugmentedAppMetadata[]
}

export interface SailIntentResolvePayload {
  appIntents: AugmentedAppIntent[]
  context: Context
  requestId: string
}

export interface SailIntentResolveResponsePayload {
  appIntents: AppIntent[]
  requestId: string
  channel: string | null
  error: string | null
}

export interface SailIntentResolveOpenChannelPayload {
  channel: string
  appId: string
}

// Channel Management Types
export interface SailChannelChangePayload {
  channel: string | null
  instanceId: string
}

export interface ChannelReceiverHelloPayload {
  instanceId: string
  userSessionId?: string
}

export interface ChannelReceiverUpdatePayload {
  tabs: TabDetail[]
}

// Context Management Types
export interface SailBroadcastContextPayload {
  context: Context
  channelId: string
}
