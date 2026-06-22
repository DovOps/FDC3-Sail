import { getBrowserDaEdgeLinkPeer } from "../../../app-connection/browser-da-edge-link"
import type { Transport } from "../../interfaces/transport"
import { getInMemoryTransportPeer } from "../../../transports/in-memory-transport"

/**
 * WCP4 identity validation needs the WCP1Hello source window for reconnect binding.
 * Window references cannot cross cloned transports (e.g. {@link InMemoryTransport}),
 * so the WCP connector stores them here keyed by temp instance id.
 */
const pendingSourceWindowRegistry = new WeakMap<Transport, Map<string, unknown>>()

function getPendingMap(transport: Transport): Map<string, unknown> {
  let map = pendingSourceWindowRegistry.get(transport)
  if (!map) {
    map = new Map<string, unknown>()
    pendingSourceWindowRegistry.set(transport, map)
  }
  return map
}

function getCoupledTransportPeer(transport: Transport): Transport | undefined {
  return getInMemoryTransportPeer(transport) ?? getBrowserDaEdgeLinkPeer(transport)
}

function forTransportEndpoints(transport: Transport): Transport[] {
  const peer = getCoupledTransportPeer(transport)
  return peer ? [transport, peer] : [transport]
}

export function setPendingWcpSourceWindow(
  transport: Transport,
  tempInstanceId: string,
  sourceWindow: unknown
): void {
  for (const endpoint of forTransportEndpoints(transport)) {
    getPendingMap(endpoint).set(tempInstanceId, sourceWindow)
  }
}

export function takePendingWcpSourceWindow(transport: Transport, tempInstanceId: string): unknown {
  for (const endpoint of forTransportEndpoints(transport)) {
    const map = pendingSourceWindowRegistry.get(endpoint)
    const sourceWindow = map?.get(tempInstanceId)
    if (sourceWindow !== undefined) {
      for (const clearEndpoint of forTransportEndpoints(transport)) {
        pendingSourceWindowRegistry.get(clearEndpoint)?.delete(tempInstanceId)
      }
      return sourceWindow
    }
  }
  return undefined
}

export function clearPendingWcpSourceWindow(transport: Transport, tempInstanceId: string): void {
  for (const endpoint of forTransportEndpoints(transport)) {
    pendingSourceWindowRegistry.get(endpoint)?.delete(tempInstanceId)
  }
}

/** Test-only: read pending source without removing. */
export function getPendingWcpSourceWindowForTesting(
  transport: Transport,
  tempInstanceId: string
): unknown {
  for (const endpoint of forTransportEndpoints(transport)) {
    const value = pendingSourceWindowRegistry.get(endpoint)?.get(tempInstanceId)
    if (value !== undefined) {
      return value
    }
  }
  return undefined
}
