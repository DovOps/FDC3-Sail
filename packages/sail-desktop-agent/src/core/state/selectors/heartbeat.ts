/**
 * Heartbeat Selectors
 *
 * Pure functions for querying heartbeat-related state.
 */

import type { AgentState, HeartbeatState } from "../types"

export const getHeartbeatState = (
  state: AgentState,
  instanceId: string
): HeartbeatState | undefined => state.heartbeats[instanceId]

export const getAllHeartbeatStates = (state: AgentState): HeartbeatState[] =>
  Object.values(state.heartbeats)
