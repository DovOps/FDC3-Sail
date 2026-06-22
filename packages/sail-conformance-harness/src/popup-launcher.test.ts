import { afterEach, describe, expect, it, vi } from "vite-plus/test"

import { createPopupCloseWatcher } from "./popup-launcher"

function createMockPopup(closed = false): Window {
  return { closed } as Window
}

describe("createPopupCloseWatcher", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("calls onPopupClosed when a registered popup reports closed", () => {
    vi.useFakeTimers()

    const onPopupClosed = vi.fn<(instanceId: string) => void>()
    const watcher = createPopupCloseWatcher({
      onPopupClosed,
      pollIntervalMs: 100,
    })

    const popup = createMockPopup(false)
    watcher.registerPopup("instance-a", popup)

    Object.defineProperty(popup, "closed", { value: true, configurable: true })

    vi.advanceTimersByTime(100)

    expect(onPopupClosed).toHaveBeenCalledOnce()
    expect(onPopupClosed).toHaveBeenCalledWith("instance-a")
    expect(watcher.hasPopup("instance-a")).toBe(false)

    watcher.stop()
  })

  it("does not call onPopupClosed while the popup remains open", () => {
    vi.useFakeTimers()

    const onPopupClosed = vi.fn<(instanceId: string) => void>()
    const watcher = createPopupCloseWatcher({
      onPopupClosed,
      pollIntervalMs: 100,
    })

    watcher.registerPopup("instance-b", createMockPopup(false))

    vi.advanceTimersByTime(300)

    expect(onPopupClosed).not.toHaveBeenCalled()

    watcher.stop()
  })

  it("stops polling after unregisterPopup removes the last popup", () => {
    vi.useFakeTimers()

    const onPopupClosed = vi.fn<(instanceId: string) => void>()
    const watcher = createPopupCloseWatcher({
      onPopupClosed,
      pollIntervalMs: 100,
    })

    const popup = createMockPopup(false)
    watcher.registerPopup("instance-c", popup)
    watcher.unregisterPopup("instance-c")

    Object.defineProperty(popup, "closed", { value: true, configurable: true })

    vi.advanceTimersByTime(300)

    expect(onPopupClosed).not.toHaveBeenCalled()

    watcher.stop()
  })
})
