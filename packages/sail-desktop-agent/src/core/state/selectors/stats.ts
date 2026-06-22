/**
 * Stats Selectors
 *
 * Pure functions for querying aggregate statistics about state.
 */

import type { AgentState } from "../types"
import { getConnectedInstances } from "./instance"

export const getStats = (state: AgentState) => ({
  instances: Object.keys(state.instances).length,
  connectedInstances: getConnectedInstances(state).length,
  intentListeners: Object.keys(state.intents.listeners).length,
  pendingIntents: Object.keys(state.intents.pending).length,
  userChannels: Object.keys(state.channels.user).length,
  appChannels: Object.keys(state.channels.app).length,
  privateChannels: Object.keys(state.channels.private).length,
  eventListeners: Object.keys(state.events.listeners).length,
  heartbeats: Object.keys(state.heartbeats).length,
})
