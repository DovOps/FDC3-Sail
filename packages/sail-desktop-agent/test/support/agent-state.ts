/**
 * BDD-only helpers for mutating DesktopAgent internal state during fixture setup.
 *
 * Production code must not expose state setters on DesktopAgent. Cucumber steps that
 * need to seed state (before DACP messages) use these helpers instead.
 */

import type { DesktopAgent } from "../../src/core/desktop-agent"
import type { PendingIntentPromiseEntry } from "../../src/core/handlers/types"
import type { AgentState } from "../../src/core/state/types"

/** Runtime shape of DesktopAgent private fields used only in tests. */
type DesktopAgentInternals = {
  state: AgentState
  pendingIntentPromises: Map<string, PendingIntentPromiseEntry>
}

function asInternals(agent: DesktopAgent): DesktopAgentInternals {
  return agent as DesktopAgent & DesktopAgentInternals
}

/**
 * Apply a state mutation the same way DACP handler `setState` does.
 */
export function applyDesktopAgentStateUpdate(
  agent: DesktopAgent,
  callback: (state: AgentState) => AgentState
): void {
  const internal = asInternals(agent)
  internal.state = callback(internal.state)
}

/**
 * Pending-intent promise map owned by the agent (for building handler contexts in steps).
 */
export function getDesktopAgentPendingIntentPromises(
  agent: DesktopAgent
): Map<string, PendingIntentPromiseEntry> {
  return asInternals(agent).pendingIntentPromises
}
