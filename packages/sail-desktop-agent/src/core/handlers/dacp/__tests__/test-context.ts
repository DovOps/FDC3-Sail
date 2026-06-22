import type { BrowserTypes } from "@finos/fdc3"
import { DEFAULT_FDC3_USER_CHANNELS } from "../../../default-user-channels"
import { DEFAULT_SAIL_IMPLEMENTATION_METADATA } from "../../../sail-default-config"
import { consoleLogger } from "../../../interfaces/logger"
import type { DACPHandlerContext, PendingIntentPromiseEntry } from "../../types"
import { createInitialState } from "../../../state/initial-state"
import type { AgentState, StateSetter } from "../../../state/types"
import type { Transport } from "../../../interfaces/transport"
import { InMemoryTransport } from "../../../../transports/in-memory-transport"
import { createDacpResponseDispatcher } from "../utils/dacp-response-utils"
export { createDacpResponseDispatcher } from "../utils/dacp-response-utils"

/** Shared agent state for contexts created with the same initialState reference (multi-connection tests). */
const sharedStateByInitialSnapshot = new WeakMap<AgentState, AgentState>()

export function createDACPTestContext(options: {
  instanceId: string
  pendingIntentPromises?: Map<string, PendingIntentPromiseEntry>
  initialState?: AgentState
}): {
  context: DACPHandlerContext
  getState: () => AgentState
} {
  const initialSnapshot = options.initialState
  let state = initialSnapshot ?? createInitialState(DEFAULT_FDC3_USER_CHANNELS)

  if (initialSnapshot && !sharedStateByInitialSnapshot.has(initialSnapshot)) {
    sharedStateByInitialSnapshot.set(initialSnapshot, state)
  }

  const readState = (): AgentState =>
    initialSnapshot ? (sharedStateByInitialSnapshot.get(initialSnapshot) ?? state) : state

  const setState: StateSetter = callback => {
    const next = callback(readState())
    state = next
    if (initialSnapshot) {
      sharedStateByInitialSnapshot.set(initialSnapshot, next)
    }
  }

  const edgeTransport = new InMemoryTransport()
  const context: DACPHandlerContext = {
    responses: createDacpResponseDispatcher(edgeTransport),
    instanceId: options.instanceId,
    getState: readState,
    setState,
    logger: consoleLogger,
    implementationMetadata: {
      ...DEFAULT_SAIL_IMPLEMENTATION_METADATA,
      provider: "test",
      providerVersion: "0.0.0",
    },
    openContextListenerTimeoutMs: 2000,
    heartbeatEnabled: true,
    heartbeatIntervalMs: 500,
    heartbeatTimeoutMs: 2000,
    pendingIntentPromises:
      options.pendingIntentPromises ?? new Map<string, PendingIntentPromiseEntry>(),
  }

  return { context, getState: readState }
}

/** Wire a mock or edge transport into handler context for isolated DACP tests. */
export function withResponseDispatcher(
  context: DACPHandlerContext,
  transport: Transport
): DACPHandlerContext {
  return { ...context, responses: createDacpResponseDispatcher(transport) }
}

export function createDacpRequestMeta(
  requestUuid: string,
  source: BrowserTypes.AppIdentifier = { appId: "TestApp", instanceId: "a1" }
): BrowserTypes.AppRequestMessageMeta {
  return {
    requestUuid,
    timestamp: new Date(),
    source,
  }
}
