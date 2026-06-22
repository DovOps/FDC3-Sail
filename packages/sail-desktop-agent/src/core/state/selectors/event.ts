/**
 * Event Selectors
 *
 * Pure functions for querying event-related state.
 */

import type { AgentState, EventListener } from "../types"

export const getEventListener = (
  state: AgentState,
  listenerId: string
): EventListener | undefined => state.events.listeners[listenerId]

export const getAllEventListeners = (state: AgentState): EventListener[] =>
  Object.values(state.events.listeners)

export const getEventListenersForType = (state: AgentState, eventType: string): string[] =>
  state.events.byEventType[eventType] ?? []

export const getEventListenersForInstance = (
  state: AgentState,
  instanceId: string
): EventListener[] => Object.values(state.events.listeners).filter(l => l.instanceId === instanceId)
