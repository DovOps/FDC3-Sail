import { useEffect, useMemo } from "react"
import type { BrowserTypes } from "@finos/fdc3"
import type { SailPlatform } from "@finos/sail-platform-api"

import { ChannelSelector } from "../components/ChannelSelector"
import { SailDesktopAgentProvider, SailPlatformProvider } from "../contexts"

type Listener = (...args: unknown[]) => void

class TestConnector {
  private listeners = new Map<string, Set<Listener>>()

  on(event: string, handler: Listener): void {
    const handlers = this.listeners.get(event) ?? new Set()
    handlers.add(handler)
    this.listeners.set(event, handlers)
  }

  off(event: string, handler: Listener): void {
    const handlers = this.listeners.get(event)
    if (!handlers) return
    handlers.delete(handler)
  }

  emit(event: string, ...args: unknown[]): void {
    const handlers = this.listeners.get(event)
    if (!handlers) return
    for (const handler of handlers) {
      handler(...args)
    }
  }

  getConnection(): null {
    return null
  }

  resolveIntentSelection(): void {}

  disconnectAppByInstanceId(): void {}
}

const TEST_INSTANCE_ID = "playwright-instance"
const TEST_APP_ID = "playwright-app"

export function ChannelSelectorTestPage() {
  const connector = useMemo(() => new TestConnector(), [])

  const channels = useMemo<BrowserTypes.Channel[]>(
    () => [
      {
        id: "fdc3.channel.1",
        type: "user",
        displayMetadata: { name: "Red", color: "#FF0000" },
      },
      {
        id: "fdc3.channel.4",
        type: "user",
        displayMetadata: { name: "Green", color: "#00FF00" },
      },
      {
        id: "fdc3.channel.5",
        type: "user",
        displayMetadata: { name: "Blue", color: "#0000FF" },
      },
    ],
    []
  )

  const platform = useMemo(
    () =>
      ({
        connector,
        agent: {
          getUserChannels: () => channels,
          getAppDirectory: () => ({
            retrieveAllApps: () => [],
            replace: async () => Promise.resolve(),
            add: () => undefined,
          }),
        },
        getUserChannels: () => channels,
        changeAppChannel: async (instanceId: string, channelId: string | null) => {
          connector.emit("channelChanged", instanceId, channelId)
          return Promise.resolve()
        },
      }) as unknown as SailPlatform,
    [channels, connector]
  )

  useEffect(() => {
    connector.emit("appConnected", {
      instanceId: TEST_INSTANCE_ID,
      appId: TEST_APP_ID,
      connectedAt: new Date(),
      hostIdentifier: "playwright-panel",
    })
    connector.emit("channelChanged", TEST_INSTANCE_ID, "fdc3.channel.1")
  }, [connector])

  return (
    <SailPlatformProvider platform={platform}>
      <SailDesktopAgentProvider platform={platform}>
        <div className="flex min-h-screen items-center justify-center gap-4 bg-gray-50">
          <div className="rounded-md border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-3 text-sm font-medium text-gray-700">Channel Selector Test</div>
            <ChannelSelector instanceId={TEST_INSTANCE_ID} />
          </div>
        </div>
      </SailDesktopAgentProvider>
    </SailPlatformProvider>
  )
}
