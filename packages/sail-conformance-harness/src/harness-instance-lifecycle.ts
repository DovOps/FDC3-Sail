import type { BrowserDesktopAgent } from "@finos/sail-desktop-agent"

import type { PopupCloseWatcher } from "./popup-launcher"
import type { HarnessPanel } from "./types"

export type HarnessInstanceCleanup = {
  prepareLaunchedHostInstance: (panel: Pick<HarnessPanel, "appId" | "instanceId">) => void
  disconnectHarnessInstance: (instanceId: string) => void
}

/**
 * Host-side instance lifecycle for FINOS toolbox runs: pre-register launcher ids
 * before browsing context load (same contract as Conformance1 iframe) and tear
 * down agent state when popups close or WCP disconnects.
 */
export function createHarnessInstanceCleanup(options: {
  desktopAgent: BrowserDesktopAgent
  popupWatcher: PopupCloseWatcher
  removePanel: (instanceId: string) => void
}): HarnessInstanceCleanup {
  const { desktopAgent, popupWatcher, removePanel } = options

  const prepareLaunchedHostInstance = (panel: Pick<HarnessPanel, "appId" | "instanceId">) => {
    desktopAgent.registerPendingHostInstance({
      appId: panel.appId,
      instanceId: panel.instanceId,
    })
  }

  const disconnectHarnessInstance = (instanceId: string) => {
    popupWatcher.unregisterPopup(instanceId)
    removePanel(instanceId)
    if (desktopAgent.getState().instances[instanceId]) {
      desktopAgent.disconnectInstance(instanceId)
    }
  }

  return { prepareLaunchedHostInstance, disconnectHarnessInstance }
}
