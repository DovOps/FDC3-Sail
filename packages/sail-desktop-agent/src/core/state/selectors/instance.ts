/**
 * Instance Selectors
 *
 * Pure functions for querying instance-related state.
 */

import type { AgentState, AppInstance, InstanceContextListener } from "../types"
import { AppInstanceState } from "../types"

export const getInstance = (state: AgentState, instanceId: string): AppInstance | undefined =>
  state.instances[instanceId]

export const getAllInstances = (state: AgentState): AppInstance[] => Object.values(state.instances)

export const getInstancesByAppId = (state: AgentState, appId: string): AppInstance[] =>
  Object.values(state.instances).filter(i => i.appId === appId)

export const instanceContextListenerMatchesBroadcast = (
  listener: InstanceContextListener,
  broadcastContextType: string
): boolean => listener.contextType === broadcastContextType || listener.contextType === "*"

export const getConnectedInstances = (state: AgentState): AppInstance[] =>
  Object.values(state.instances).filter(i => i.state === AppInstanceState.CONNECTED)

export const getInstancesByState = (
  state: AgentState,
  instanceState: AppInstanceState | AppInstanceState[]
): AppInstance[] => {
  const states = Array.isArray(instanceState) ? instanceState : [instanceState]
  return Object.values(state.instances).filter(i => states.includes(i.state))
}

export const getInstancesWithContextListener = (
  state: AgentState,
  contextType: string
): AppInstance[] =>
  Object.values(state.instances).filter(instance =>
    Object.values(instance.contextListeners).some(listener =>
      instanceContextListenerMatchesBroadcast(listener, contextType)
    )
  )

export const getInstancesWithPrivateChannel = (
  state: AgentState,
  channelId: string
): AppInstance[] =>
  Object.values(state.instances).filter(i => i.privateChannels.includes(channelId))
