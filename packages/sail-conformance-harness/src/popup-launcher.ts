import type { HarnessPanel } from "./types"

/** Default popup chrome — omit noopener/noreferrer so WCP can use window.opener. */
export const HARNESS_POPUP_FEATURES =
  "width=1024,height=768,menubar=no,toolbar=no,location=yes,status=no,resizable=yes,scrollbars=yes"

export type PopupCloseWatcherOptions = {
  onPopupClosed: (instanceId: string) => void
  pollIntervalMs?: number
}

export type PopupCloseWatcher = {
  registerPopup: (instanceId: string, popup: Window) => void
  unregisterPopup: (instanceId: string) => void
  hasPopup: (instanceId: string) => boolean
  closePopup: (instanceId: string) => boolean
  stop: () => void
}

/**
 * Open a conformance app in a new top-level browsing context (tab). The window
 * name must match {@link HarnessPanel.instanceId} so the app can claim it in WCP4.
 *
 * Omit window features so browsers open a tab rather than a sized popup.
 */
export function openHarnessPopup(panel: HarnessPanel): Window | null {
  return window.open(panel.url, panel.instanceId)
}

/**
 * Poll `window.closed` for harness popups and invoke cleanup when a tab closes.
 * Does not override `window.close` on child windows.
 */
export function createPopupCloseWatcher(options: PopupCloseWatcherOptions): PopupCloseWatcher {
  const popups = new Map<string, Window>()
  const pollIntervalMs = options.pollIntervalMs ?? 100
  let intervalId: ReturnType<typeof setInterval> | undefined

  const stopPolling = () => {
    if (intervalId !== undefined) {
      clearInterval(intervalId)
      intervalId = undefined
    }
  }

  const pollClosedPopups = () => {
    for (const [instanceId, popup] of popups) {
      if (popup.closed) {
        popups.delete(instanceId)
        options.onPopupClosed(instanceId)
      }
    }

    if (popups.size === 0) {
      stopPolling()
    }
  }

  const startPollingIfNeeded = () => {
    if (intervalId !== undefined || popups.size === 0) {
      return
    }

    intervalId = setInterval(pollClosedPopups, pollIntervalMs)
  }

  return {
    registerPopup(instanceId: string, popup: Window) {
      popups.set(instanceId, popup)
      startPollingIfNeeded()
    },

    unregisterPopup(instanceId: string) {
      popups.delete(instanceId)
      if (popups.size === 0) {
        stopPolling()
      }
    },

    hasPopup(instanceId: string) {
      return popups.has(instanceId)
    },

    closePopup(instanceId: string) {
      const popup = popups.get(instanceId)
      if (!popup || popup.closed) {
        return false
      }
      popup.close()
      return true
    },

    stop() {
      stopPolling()
      popups.clear()
    },
  }
}
