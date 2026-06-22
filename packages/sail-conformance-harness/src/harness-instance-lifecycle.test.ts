/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vite-plus/test"

import { createHarnessInstanceCleanup } from "./harness-instance-lifecycle"
import { createPopupCloseWatcher } from "./popup-launcher"

describe("createHarnessInstanceCleanup", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("pre-registers launched instance as PENDING before browsing context connects", () => {
    const registerPendingHostInstance = vi.fn()
    const desktopAgent = {
      registerPendingHostInstance,
      getState: () => ({ instances: {} }),
      disconnectInstance: vi.fn(),
    }

    const cleanup = createHarnessInstanceCleanup({
      desktopAgent: desktopAgent as never,
      popupWatcher: createPopupCloseWatcher({ onPopupClosed: vi.fn() }),
      removePanel: vi.fn(),
    })

    cleanup.prepareLaunchedHostInstance({ appId: "MockAppId", instanceId: "mock-instance-1" })

    expect(registerPendingHostInstance).toHaveBeenCalledWith({
      appId: "MockAppId",
      instanceId: "mock-instance-1",
    })
  })

  it("disconnectHarnessInstance removes panel, unregisters popup, and disconnects agent state", () => {
    const removePanel = vi.fn()
    const disconnectInstance = vi.fn()
    const onPopupClosed = vi.fn()

    const popupWatcher = createPopupCloseWatcher({ onPopupClosed })
    const popup = { closed: false } as Window
    popupWatcher.registerPopup("mock-instance-2", popup)

    const cleanup = createHarnessInstanceCleanup({
      desktopAgent: {
        registerPendingHostInstance: vi.fn(),
        getState: () => ({
          instances: {
            "mock-instance-2": { appId: "MockAppId", state: "connected" },
          },
        }),
        disconnectInstance,
      } as never,
      popupWatcher,
      removePanel,
    })

    cleanup.disconnectHarnessInstance("mock-instance-2")

    expect(removePanel).toHaveBeenCalledWith("mock-instance-2")
    expect(popupWatcher.hasPopup("mock-instance-2")).toBe(false)
    expect(disconnectInstance).toHaveBeenCalledWith("mock-instance-2")
  })
})
