import type { AppLauncher } from "../../host-contracts/app-launcher"
import { DEFAULT_FDC3_USER_CHANNELS } from "../../core/default-user-channels"
import { createBrowserDesktopAgent } from "../../presets/create-browser-desktop-agent"
import type { BrowserDesktopAgentOptions } from "../../presets/create-browser-desktop-agent"
import type { DesktopAgent } from "../../core/desktop-agent"

export const CHANNEL_ID = "fdc3.channel.1"
export const HOST_LAUNCHER_INSTANCE_ID = "uuid-host-0"

export const PORTFOLIO_APP = {
  appId: "portfolioApp",
  title: "Portfolio",
  type: "web" as const,
  details: { url: "https://example.com/portfolio" },
}

export const CHART_APP = {
  appId: "chartApp",
  title: "Chart",
  type: "web" as const,
  details: { url: "https://example.com/chart" },
}

export type TestAgentOptions = Pick<
  BrowserDesktopAgentOptions,
  | "appLauncher"
  | "heartbeatEnabled"
  | "heartbeatIntervalMs"
  | "heartbeatTimeoutMs"
  | "openContextListenerTimeoutMs"
> & {
  disconnectGracePeriod?: number
}

export function createTestAgent(options?: TestAgentOptions): DesktopAgent {
  const agent = createBrowserDesktopAgent({
    userChannels: DEFAULT_FDC3_USER_CHANNELS,
    apps: [PORTFOLIO_APP, CHART_APP],
    appLauncher: options?.appLauncher,
    heartbeatEnabled: options?.heartbeatEnabled,
    heartbeatIntervalMs: options?.heartbeatIntervalMs,
    heartbeatTimeoutMs: options?.heartbeatTimeoutMs,
    openContextListenerTimeoutMs: options?.openContextListenerTimeoutMs,
    wcpOptions: {
      getIntentResolverUrl: () => false,
      getChannelSelectorUrl: () => false,
      fdc3Version: "2.2",
      handshakeTimeout: 30_000,
      disconnectGracePeriod: options?.disconnectGracePeriod,
    },
  })

  return agent
}

export function createHostInstanceAppLauncher(): AppLauncher {
  return {
    launch(request) {
      return Promise.resolve({
        appId: request.app.appId,
        instanceId: request.app.instanceId ?? HOST_LAUNCHER_INSTANCE_ID,
      })
    },
  }
}
