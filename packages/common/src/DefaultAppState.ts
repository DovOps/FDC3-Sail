import { AppOpenDetails, AppState } from "./AppState"
import { AppHosting } from "./app-hosting"
import { DirectoryApp, WebAppDetails, State } from "@finos/fdc3-sail-da-impl"
import {
  APP_HELLO,
  AppHelloArgs,
  FDC3_APP_EVENT,
  FDC3_DA_EVENT,
  SailAppStateArgs,
} from "./message-types"
import { WebConnectionProtocol1Hello } from "@finos/fdc3-schema/dist/generated/api/BrowserTypes"
import { ServerState } from "./ServerState"
import { ClientState } from "./ClientState"
import { io, Socket } from "socket.io-client"

export class DefaultAppState implements AppState {
  windowInformation = new Map<Window, string>()
  states: SailAppStateArgs = []
  callbacks: (() => void)[] = []
  cs: ClientState | null = null
  ss: ServerState | null = null
  private appBridgeSockets = new Map<string, Socket>()

  getAppState(instanceId: string): State | undefined {
    return this.states.find((x) => x.instanceId == instanceId)?.state
  }

  setAppState(state: SailAppStateArgs): void {
    this.states = state
    this.callbacks.forEach((x) => {
      x()
    })
  }

  getServerState(): ServerState {
    if (this.ss == null) {
      throw new Error("Server state not set")
    }
    return this.ss
  }

  getClientState(): ClientState {
    if (this.cs == null) {
      throw new Error("Client state not set")
    }
    return this.cs
  }

  addStateChangeCallback(cb: () => void): void {
    this.callbacks.push(cb)
  }

  getDirectoryAppForUrl(identityUrl: string): DirectoryApp | undefined {
    const strippedIdentityUrl = identityUrl.replace(/\/$/, "")
    const applications: DirectoryApp[] = this.cs?.getKnownApps() ?? []
    const firstMatchingApp = applications.find((x) => {
      const d = x.details as WebAppDetails
      return (
        d.url == strippedIdentityUrl ||
        d.url == identityUrl ||
        (d.url.startsWith("/") && identityUrl.endsWith(d.url))
      ) // allows for local urls
    })
    return firstMatchingApp
  }

  init(ss: ServerState, cs: ClientState): void {
    if (this.cs == null) {
      this.cs = cs
      this.ss = ss
      // sets up postMessage listener for new applications joining
      // nosemgrep: javascript.browser.security.insufficient-postmessage-origin-validation.insufficient-postmessage-origin-validation
      window.addEventListener("message", (e: MessageEvent) => {
        const event = e

        if ((event.data as { type: string }).type == "WCP1Hello") {
          const data = event.data as WebConnectionProtocol1Hello
          const source = event.source as Window
          const origin = event.origin

          console.log("Received: " + JSON.stringify(event.data))

          const appD = this.getDirectoryAppForUrl(data.payload.identityUrl)
          const appId = appD?.appId
          this.getInstanceIdForWindow(source)
            .then(async (instanceId) => {
              if (appD && instanceId) {
                const wcp3Sent = await this.tryDirectWcp3Handshake(
                  source,
                  origin,
                  data.meta.connectionAttemptUuid,
                  instanceId,
                  appId ?? "unknown",
                  cs.getUserSessionID(),
                )
                if (!wcp3Sent) {
                  this.sendWcp2LoadUrl(
                    source,
                    origin,
                    data.meta.connectionAttemptUuid,
                    cs.getUserSessionID(),
                    instanceId,
                    appId ?? "unknown",
                  )
                }
              } else {
                console.error(
                  "Illegal handshake attempt",
                  JSON.stringify(data, null, 2),
                  appD,
                  instanceId,
                )
              }
            })
            .catch((e: unknown) => {
              console.error("Error getting directory app for url", e)
            })
        }
      })
    }
  }

  registerAppWindow(window: Window, instanceId: string): void {
    this.windowInformation.set(window, instanceId)
  }

  private sendWcp2LoadUrl(
    source: Window,
    origin: string,
    connectionAttemptUuid: string,
    userSessionId: string,
    instanceId: string,
    appId: string,
  ): void {
    source.postMessage(
      {
        type: "WCP2LoadUrl",
        meta: {
          connectionAttemptUuid,
          timestamp: new Date(),
        },
        payload: {
          iframeUrl:
            window.location.origin +
            `/html/embed.html?connectionAttemptUuid=${connectionAttemptUuid}&desktopAgentId=${userSessionId}&instanceId=${instanceId}&appId=${appId}`,
        },
      },
      origin,
    )
  }

  private async tryDirectWcp3Handshake(
    source: Window,
    origin: string,
    connectionAttemptUuid: string,
    instanceId: string,
    appId: string,
    userSessionId: string,
  ): Promise<boolean> {
    const socket = io()
    const previous = this.appBridgeSockets.get(instanceId)
    if (previous) {
      previous.disconnect()
      this.appBridgeSockets.delete(instanceId)
    }

    return new Promise<boolean>((resolve) => {
      const channel = new MessageChannel()
      let settled = false
      const finish = (result: boolean) => {
        if (settled) {
          return
        }
        settled = true
        window.clearTimeout(timeout)
        if (!result) {
          channel.port2.close()
          socket.disconnect()
        }
        resolve(result)
      }

      socket.on("connect_error", (error) => {
        console.warn("Direct WCP3 bridge connect error", error)
        finish(false)
      })

      socket.on("connect", async () => {
        try {
          socket.on(FDC3_DA_EVENT, (data: unknown) => {
            channel.port2.postMessage(data)
          })

          channel.port2.onmessage = (event: MessageEvent) => {
            if (
              event.data &&
              typeof event.data === "object" &&
              (event.data as { type?: string }).type === "WCP6Goodbye"
            ) {
              channel.port2.close()
              socket.disconnect()
              this.appBridgeSockets.delete(instanceId)
              return
            }
            socket.emit(FDC3_APP_EVENT, event.data, instanceId)
          }

          const hosting = await socket.emitWithAck(APP_HELLO, {
            userSessionId,
            instanceId,
            appId,
          } as AppHelloArgs)

          const suffix = `?desktopAgentId=${userSessionId}&instanceId=${instanceId}`
          const intentResolverUrl =
            hosting == AppHosting.Tab
              ? window.location.origin +
                `/html/ui/intent-resolver.html${suffix}`
              : undefined
          const channelSelectorUrl =
            hosting == AppHosting.Tab
              ? window.location.origin +
                `/html/ui/channel-selector.html${suffix}`
              : undefined

          source.postMessage(
            {
              type: "WCP3Handshake",
              meta: {
                connectionAttemptUuid,
                timestamp: new Date(),
              },
              payload: {
                fdc3Version: "2.2",
                intentResolverUrl,
                channelSelectorUrl,
              },
            },
            origin,
            [channel.port1],
          )

          this.appBridgeSockets.set(instanceId, socket)
          finish(true)
        } catch (error) {
          console.warn("Direct WCP3 bridge setup failed", error)
          finish(false)
        }
      })

      const timeout = window.setTimeout(() => {
        console.warn("Direct WCP3 bridge setup timed out", {
          instanceId,
          appId,
          connectionAttemptUuid,
        })
        finish(false)
      }, 8000)
    })
  }

  /**
   * Since sometimes it takes the app windows a little while to load, here
   */
  async getInstanceIdForWindow(window: Window): Promise<string | undefined> {
    return new Promise<string | undefined>((resolve) => {
      const endTime = new Date().getTime() + 10000

      const retry = () => {
        const instanceId = this.windowInformation.get(window)
        if (instanceId) {
          resolve(instanceId)
        } else {
          if (new Date().getTime() > endTime) {
            resolve(undefined)
          } else {
            setTimeout(retry, 200)
          }
        }
      }

      retry()
    })
  }

  /**
   * Creates a unique title for the app by finding the first unused number
   * for the given app title
   */
  createTitle(detail: DirectoryApp): string {
    // Get all existing panels
    const existingPanels = this.cs?.getPanels() ?? []

    // Get all numbers currently in use for this app title
    const usedNumbers = new Set(
      existingPanels
        .filter((p) => p.title.startsWith(detail.title))
        .map((p) => {
          const match = /\d+$/.exec(p.title)
          return match ? parseInt(match[0]) : 0
        }),
    )

    // Find first unused number starting from 1
    let number = 1
    while (usedNumbers.has(number)) {
      number++
    }

    return `${detail.title} ${number.toString()}`
  }

  /**
   * Opens either a new panel or a browser tab for the application to go in,
   * returns the instance id for the new thing.
   */
  open(
    detail: DirectoryApp,
    destination?: AppHosting,
  ): Promise<AppOpenDetails> {
    return new Promise((resolve) => {
      const sailManifest = detail.hostManifests?.sail ?? {}
      const forceNewWindow =
        (typeof sailManifest === "string" ? {} : sailManifest).forceNewWindow ??
        false
      const hosting: AppHosting =
        (forceNewWindow ? AppHosting.Tab : undefined) ??
        destination ??
        AppHosting.Frame
      const instanceTitle = this.createTitle(detail)
      if (hosting == AppHosting.Tab) {
        this.getServerState()
          .registerAppLaunch(detail.appId, hosting, null, instanceTitle)
          .then((instanceId) => {
            const w = window.open(
              (detail.details as WebAppDetails).url,
              "_blank",
            )
            if (w) {
              this.registerAppWindow(w, instanceId)
              resolve({ instanceId, channel: null, instanceTitle })
            } else {
              throw new Error("Failed to open window")
            }
          })
          .catch((e: unknown) => {
            console.error("Error registering app launch", e)
          })
      } else {
        const channel = this.getClientState().getActiveTab().id
        this.getServerState()
          .registerAppLaunch(detail.appId, hosting, channel, instanceTitle)
          .then((instanceId) => {
            this.getClientState().newPanel(detail, instanceId, instanceTitle)
            resolve({ instanceId, channel, instanceTitle })
          })
          .catch((e: unknown) => {
            console.error("Error registering app launch", e)
          })
      }
    })
  }
}
