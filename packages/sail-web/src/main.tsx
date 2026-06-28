import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { SailAppLauncher, SailPlatform, type DirectoryApp } from "@finos/sail-platform-api"
import type { AppMetadata } from "@finos/fdc3"

import conformanceAppDirectory from "../../sail-conformance-harness/conformance-appd.json"
import defaultAppDirectory from "../fixtures/default-app-directory.json"

import "./index.css"
import App from "./App"
import { getConfiguredAppDirectoryUrls } from "./config/app-directory-sources"
import { useWorkspaceStore } from "./stores/workspace-store"
import { ChannelSelectorTestPage } from "./tests/ChannelSelectorTestPage"

const isChannelSelectorE2e =
  new URLSearchParams(window.location.search).get("e2e") === "channel-selector"

if (isChannelSelectorE2e) {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ChannelSelectorTestPage />
    </StrictMode>
  )
} else {
  // Initialize the FDC3 Desktop Agent BEFORE React renders
  // This ensures the agent is listening for WCP1Hello messages when getAgent() is called
  console.log("[Sail] Initializing FDC3 Desktop Agent")

  // Create app launcher that integrates with Sail UI workspace store
  const appLauncher = new SailAppLauncher({
    onLaunchApp: (appMetadata: AppMetadata, instanceId: string, context?: unknown) => {
      void context
      const workspaceStore = useWorkspaceStore.getState()
      const { activeWorkspaceId } = workspaceStore

      if (!activeWorkspaceId) {
        throw new Error("No active workspace available")
      }

      // Get active tab for the workspace
      const workspace = workspaceStore.getWorkspace(activeWorkspaceId)
      if (!workspace) {
        throw new Error(`Workspace ${activeWorkspaceId} not found`)
      }

      const activeTabId = workspace.layout.activeTabId
      if (!activeTabId) {
        throw new Error(`No active tab in workspace ${activeWorkspaceId}`)
      }

      // Extract app details from metadata
      const details =
        "details" in appMetadata ? (appMetadata as { details?: unknown }).details : undefined
      const detailsUrl =
        details && typeof details === "object" && "url" in details
          ? (details as { url?: unknown }).url
          : undefined
      const url = typeof detailsUrl === "string" ? detailsUrl : undefined
      if (!url) {
        throw new Error(`App ${appMetadata.appId} has no URL in metadata`)
      }

      // Pre-register the instance in the Desktop Agent's AppInstanceRegistry
      // This allows the app to reconnect to this instanceId via WCP4
      // We'll need to access the desktop agent after it's created, so we'll do this
      // in a callback after the platform is created

      // Create panel for the app
      const panel = {
        panelId: instanceId,
        appId: appMetadata.appId,
        title: appMetadata.title || appMetadata.name || appMetadata.appId,
        url,
        icon: appMetadata.icons?.[0]?.src || null,
      }

      // Add panel to the active workspace and tab
      workspaceStore.addPanel(activeWorkspaceId, activeTabId, panel)

      console.log(`[Sail] Launched app ${appMetadata.appId} as panel ${instanceId}`, {
        workspaceId: activeWorkspaceId,
        tabId: activeTabId,
        url,
      })
      return Promise.resolve()
    },
  })

  const platform = new SailPlatform({
    debug: true,
    appLauncher,
    appDirectories: getConfiguredAppDirectoryUrls(),
    apps: [
      ...defaultAppDirectory.applications,
      ...conformanceAppDirectory.applications,
    ] as unknown as DirectoryApp[],
  })

  // Start the agent - this begins listening for WCP1Hello messages
  platform.start()

  console.log("[Sail] FDC3 Browser Desktop Agent started and listening for connections")

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App platform={platform} />
    </StrictMode>
  )
}
