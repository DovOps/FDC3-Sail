/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vite-plus/test"

import { createHarnessBootstrap, getConformance1PanelState } from "./harness-bootstrap"
import { createPopupCloseWatcher } from "./popup-launcher"

describe("createHarnessBootstrap", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("pre-registers Conformance1 host instance id as PENDING before WCP connects", () => {
    const bootstrap = createHarnessBootstrap({ debug: false })
    try {
      const panelState = getConformance1PanelState(bootstrap)

      expect(panelState).toBeDefined()
      expect(panelState?.state).toBe("pending")

      const instance = bootstrap.desktopAgent.getState().instances[panelState!.instanceId]
      expect(instance?.appId).toBe("Conformance1")
    } finally {
      bootstrap.desktopAgent.stop()
    }
  })
})

describe("harness popup disconnect cleanup", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("disconnects agent instance when popup close watcher fires", () => {
    vi.useFakeTimers()

    const disconnectInstance = vi.fn()
    const popup = { closed: false } as Window

    const watcher = createPopupCloseWatcher({
      onPopupClosed: instanceId => {
        disconnectInstance(instanceId)
      },
      pollIntervalMs: 100,
    })

    watcher.registerPopup("popup-instance-1", popup)
    Object.defineProperty(popup, "closed", { value: true, configurable: true })

    vi.advanceTimersByTime(100)

    expect(disconnectInstance).toHaveBeenCalledWith("popup-instance-1")
    watcher.stop()
  })
})
