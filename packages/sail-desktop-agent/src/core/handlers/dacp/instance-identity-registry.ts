import type { Transport } from "../../interfaces/transport"

export interface InstanceIdentityRecord {
  appId: string
  instanceUuid: string
  origin: string
  sourceWindow: unknown
}

const instanceIdentityRegistry = new WeakMap<Transport, Map<string, InstanceIdentityRecord>>()

export function getInstanceIdentityMap(transport: Transport): Map<string, InstanceIdentityRecord> {
  let map = instanceIdentityRegistry.get(transport)
  if (!map) {
    map = new Map<string, InstanceIdentityRecord>()
    instanceIdentityRegistry.set(transport, map)
  }
  return map
}

/** Remove a disconnected instance from the per-transport identity map. */
export function pruneInstanceIdentity(transport: Transport, instanceId: string): void {
  getInstanceIdentityMap(transport).delete(instanceId)
}

/** Test-only: count of identity records retained for a transport. */
export function getInstanceIdentityCountForTesting(transport: Transport): number {
  return instanceIdentityRegistry.get(transport)?.size ?? 0
}

/** Test-only: whether a specific instance id is still in the identity map. */
export function hasInstanceIdentityForTesting(transport: Transport, instanceId: string): boolean {
  return instanceIdentityRegistry.get(transport)?.has(instanceId) ?? false
}
