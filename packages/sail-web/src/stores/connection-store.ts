import { enableMapSet } from "immer"
import { create } from "zustand"
import { immer } from "zustand/middleware/immer"
import type { AppConnectionMetadata, SailPlatform } from "@finos/sail-platform-api"

// Immer draft support for Map/Set in connection state
enableMapSet()

export type ConnectionStatus = "connecting" | "connected" | "disconnected"

export interface Connection {
  instanceId: string
  appId: string
  status: ConnectionStatus
  connectedAt: Date
  panelId?: string // Link to dockview panel
  channelId?: string | null // Current FDC3 user channel (null = no channel)
}

interface ConnectionState {
  connections: Map<string, Connection>
  // Map from panelId to instanceId for quick lookup
  panelToConnection: Map<string, string>
  // Track panels waiting for connections (for cross-origin iframes where panelId is undefined)
  waitingPanels: Map<string, { panelId: string; appId: string }>
}

interface ConnectionActions {
  getConnection: (instanceId: string) => Connection | undefined
  getConnectionByPanelId: (panelId: string) => Connection | undefined
  getAllConnections: () => Connection[]
  registerPanel: (panelId: string, appId: string) => void
  linkPanelToConnection: (panelId: string, instanceId: string) => void
  updateConnectionStatus: (instanceId: string, status: ConnectionStatus) => void
}

export interface ConnectionStore extends ConnectionState, ConnectionActions {}

export const createConnectionStore = (platform: SailPlatform) => {
  const store = create<ConnectionStore>()(
    immer((set, get) => ({
      // Initial state
      connections: new Map(),
      panelToConnection: new Map(),
      // Track panels waiting for connections (for cross-origin iframes where panelId is undefined)
      waitingPanels: new Map<string, { panelId: string; appId: string }>(),

      // Actions
      getConnection: (instanceId: string) => {
        return get().connections.get(instanceId)
      },

      getConnectionByPanelId: (panelId: string) => {
        const instanceId = get().panelToConnection.get(panelId)
        if (!instanceId) return undefined
        return get().connections.get(instanceId)
      },

      getAllConnections: () => {
        return Array.from(get().connections.values())
      },

      registerPanel: (panelId: string, appId: string) =>
        set(state => {
          // When a panel is registered, check if there's already a connection with this panelId
          // The panelId is extracted from the iframe's name attribute during WCP handshake
          // However, for cross-origin iframes, panelId may be undefined, so we also check by appId
          for (const connection of state.connections.values()) {
            if (connection.panelId === panelId) {
              // Connection already linked to this panel - update the reverse mapping
              state.panelToConnection.set(panelId, connection.instanceId)
              state.waitingPanels.delete(panelId) // Remove from waiting if it was there
              return
            }
            // For cross-origin iframes, panelId may be undefined in the connection
            // Try to match by appId if the connection doesn't have a panelId yet
            // WARNING: This could match the wrong connection if multiple instances of the same app exist
            if (!connection.panelId && connection.appId === appId) {
              // Link this connection to the panel
              connection.panelId = panelId
              state.panelToConnection.set(panelId, connection.instanceId)
              state.waitingPanels.delete(panelId) // Remove from waiting
              console.log(
                `[ConnectionStore] Panel ${panelId} linked to connection ${connection.instanceId} (cross-origin match by appId)`
              )
              return
            }
          }
          // Connection not yet established - store as waiting panel
          // It will be linked when appConnected fires (for cross-origin iframes)
          state.waitingPanels.set(panelId, { panelId, appId })
        }),

      linkPanelToConnection: (panelId: string, instanceId: string) =>
        set(state => {
          const connection = state.connections.get(instanceId)
          if (connection) {
            connection.panelId = panelId
            state.panelToConnection.set(panelId, instanceId)
          }
        }),

      updateConnectionStatus: (instanceId: string, status: ConnectionStatus) =>
        set(state => {
          const connection = state.connections.get(instanceId)
          if (connection) {
            connection.status = status
          }
        }),
    }))
  )

  const { apps, channels } = platform

  apps.onConnect((metadata: AppConnectionMetadata) => {
    store.setState(state => {
      const connection: Connection = {
        instanceId: metadata.instanceId,
        appId: metadata.appId,
        status: "connected",
        connectedAt: metadata.connectedAt,
        panelId: metadata.hostIdentifier,
      }
      state.connections.set(metadata.instanceId, connection)

      if (metadata.hostIdentifier) {
        state.panelToConnection.set(metadata.hostIdentifier, metadata.instanceId)
        state.waitingPanels.delete(metadata.hostIdentifier)
      } else {
        const waitingPanel = Array.from(state.waitingPanels.values()).find(
          wp => wp.appId === metadata.appId
        )
        if (waitingPanel) {
          connection.panelId = waitingPanel.panelId
          state.panelToConnection.set(waitingPanel.panelId, metadata.instanceId)
          state.waitingPanels.delete(waitingPanel.panelId)
          console.log(
            `[ConnectionStore] Linked connection ${metadata.instanceId} to waiting panel ${waitingPanel.panelId} (cross-origin)`
          )
        }
      }
    })
  })

  apps.onDisconnect((instanceId: string) => {
    console.log("[ConnectionStore] App disconnected:", instanceId)
    store.setState(state => {
      const connection = state.connections.get(instanceId)
      if (connection) {
        if (connection.panelId) {
          state.panelToConnection.delete(connection.panelId)
          console.log(`[ConnectionStore] Removed panel mapping for ${connection.panelId}`)
        }
        state.connections.delete(instanceId)
        console.log(`[ConnectionStore] Removed connection for instance ${instanceId}`)
      }
    })
  })

  apps.onHandshakeFailure(({ error, connectionAttemptUuid }) => {
    console.error("[ConnectionStore] Handshake failed:", error, connectionAttemptUuid)
  })

  channels.onAppChannelChange(({ instanceId, channelId }) => {
    console.log("[ConnectionStore] Channel changed:", instanceId, channelId)
    store.setState(state => {
      const connection = state.connections.get(instanceId)
      if (connection) {
        connection.channelId = channelId
      }
    })
  })

  return store
}
