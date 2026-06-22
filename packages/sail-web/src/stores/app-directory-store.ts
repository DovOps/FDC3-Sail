import {
  retrieveAllApps,
  replaceDirectoriesInState,
  type AgentState,
  type DesktopAgent,
} from "@finos/sail-desktop-agent"
import { create } from "zustand"
import { immer } from "zustand/middleware/immer"
import type { DirectoryApp } from "../types/common"
import type { SailPlatform } from "@finos/sail-platform-api"

type DesktopAgentInternals = {
  state: AgentState
}

/** Host-side catalog writes — same internal path as DACP handler setState. */
async function applyAgentStateUpdateAsync(
  agent: DesktopAgent,
  callback: (state: AgentState) => Promise<AgentState>
): Promise<void> {
  const internal = agent as unknown as DesktopAgentInternals
  internal.state = await callback(agent.getState())
}

interface AppDirectoryState {
  apps: DirectoryApp[]
  isLoading: boolean
  error: string | null
  lastUpdated: Date | null
  directoryUrls: string[]
}

interface AppDirectoryActions {
  setApps: (apps: DirectoryApp[]) => void
  addApp: (app: DirectoryApp) => void
  removeApp: (appId: string) => void
  updateApp: (appId: string, updates: Partial<DirectoryApp>) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearApps: () => void
  loadApps: () => void
  refreshApps: () => Promise<void>
  setDirectoryUrls: (urls: string[]) => void
  loadDirectoriesFromUrls: (urls: string[]) => Promise<void>
}

export interface AppDirectoryStore extends AppDirectoryState, AppDirectoryActions {}

export const createAppDirectoryStore = (platform: SailPlatform) =>
  create<AppDirectoryStore>()(
    immer((set, get) => ({
      // Initial state
      apps: [] as DirectoryApp[],
      isLoading: false,
      error: null as string | null,
      lastUpdated: null as Date | null,
      directoryUrls: [] as string[],

      // Actions
      setApps: (apps: DirectoryApp[]) =>
        set(state => {
          state.apps = apps
          state.lastUpdated = new Date()
          state.error = null
        }),

      addApp: (app: DirectoryApp) =>
        set(state => {
          const existingIndex = state.apps.findIndex((a: DirectoryApp) => a.appId === app.appId)
          if (existingIndex >= 0) {
            state.apps[existingIndex] = app
          } else {
            state.apps.push(app)
          }
          state.lastUpdated = new Date()
        }),

      removeApp: (appId: string) =>
        set(state => {
          state.apps = state.apps.filter((app: DirectoryApp) => app.appId !== appId)
          state.lastUpdated = new Date()
        }),

      updateApp: (appId: string, updates: Partial<DirectoryApp>) =>
        set(state => {
          const appIndex = state.apps.findIndex((app: DirectoryApp) => app.appId === appId)
          if (appIndex >= 0) {
            state.apps[appIndex] = { ...state.apps[appIndex], ...updates }
            state.lastUpdated = new Date()
          }
        }),

      setLoading: (loading: boolean) =>
        set(state => {
          state.isLoading = loading
        }),

      setError: (error: string | null) =>
        set(state => {
          state.error = error
          if (error) {
            state.isLoading = false
          }
        }),

      clearApps: () =>
        set(state => {
          state.apps = []
          state.lastUpdated = new Date()
          state.error = null
        }),

      setDirectoryUrls: (urls: string[]) =>
        set(state => {
          state.directoryUrls = urls
        }),

      // Load apps from the browser desktop agent's app directory
      loadApps: () => {
        const { setLoading, setError, setApps } = get()

        try {
          setLoading(true)
          setError(null)

          const apps = retrieveAllApps(platform.agent.getState().appDirectory)

          setApps(apps)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Failed to load apps"
          setError(errorMessage)
          console.error("Failed to load app directory:", error)
        } finally {
          setLoading(false)
        }
      },

      // Load directories from URLs into the desktop agent
      loadDirectoriesFromUrls: async (urls: string[]) => {
        const { setLoading, setError, loadApps, setDirectoryUrls } = get()

        try {
          setLoading(true)
          setError(null)
          setDirectoryUrls(urls)

          await applyAgentStateUpdateAsync(platform.agent, state =>
            replaceDirectoriesInState(state, urls)
          )

          loadApps()
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Failed to load directories from URLs"
          setError(errorMessage)
          console.error("Failed to load directories from URLs:", error)
        } finally {
          setLoading(false)
        }
      },

      refreshApps: () => {
        const { loadApps } = get()
        loadApps()
        return Promise.resolve()
      },
    }))
  )
