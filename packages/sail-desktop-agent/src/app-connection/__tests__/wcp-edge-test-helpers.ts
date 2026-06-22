/**
 * Shared helpers for WCP edge-contract integration tests.
 *
 * @vitest-environment jsdom
 */

import { expect, vi } from "vite-plus/test"
import type { BrowserTypes, Context } from "@finos/fdc3"
import type { DesktopAgent } from "../../core/desktop-agent"
import { getBrowserDesktopAgentSession } from "../../presets/browser-session"

export const TEST_ORIGIN = "https://example.com"

export type WcpConnectedApp = {
  connectionAttemptUuid: string
  tempInstanceId: string
  canonicalInstanceId: string
  appPort: MessagePort
  appId: string
}

export function createWCP1Hello(
  connectionAttemptUuid: string,
  identityUrl: string
): BrowserTypes.WebConnectionProtocol1Hello {
  return {
    type: "WCP1Hello",
    meta: {
      connectionAttemptUuid,
      timestamp: new Date().toISOString(),
    },
    payload: {
      identityUrl,
      actualUrl: identityUrl,
      fdc3Version: "2.2",
    },
  } as unknown as BrowserTypes.WebConnectionProtocol1Hello
}

export function createMessageEvent(
  data: unknown,
  source: Window = window,
  origin = TEST_ORIGIN
): MessageEvent {
  return new MessageEvent("message", { data, source, origin })
}

/** InMemoryTransport delivers on the next macrotask; flush before asserting. */
export async function flushAsyncDelivery(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0))
}

function captureAppMessagePort(connectionAttemptUuid: string, identityUrl: string): MessagePort {
  const postMessageSpy = vi.spyOn(window, "postMessage")
  window.dispatchEvent(createMessageEvent(createWCP1Hello(connectionAttemptUuid, identityUrl)))

  const calls = postMessageSpy.mock.calls as unknown as Array<
    [BrowserTypes.WebConnectionProtocol3Handshake, string, MessagePort[]]
  >
  expect(calls.length).toBeGreaterThan(0)

  const [handshakeMessage, targetOrigin, ports] = calls[0]
  expect(handshakeMessage.type).toBe("WCP3Handshake")
  expect(handshakeMessage.meta.connectionAttemptUuid).toBe(connectionAttemptUuid)
  expect(targetOrigin).toBe(TEST_ORIGIN)
  expect(ports).toEqual(expect.arrayContaining([expect.any(MessagePort)]))

  postMessageSpy.mockRestore()

  const appPort = ports[0]
  appPort.start()
  return appPort
}

export async function connectWcpApp(
  agent: DesktopAgent,
  options: {
    connectionAttemptUuid: string
    appId: string
    identityUrl: string
    hostInstanceId?: string
    instanceUuid?: string
  }
): Promise<WcpConnectedApp> {
  const { connectionAttemptUuid, appId, identityUrl, hostInstanceId, instanceUuid } = options
  const tempInstanceId = `temp-${connectionAttemptUuid}`
  const { wcpConnector } = getBrowserDesktopAgentSession(agent)

  const appPort = captureAppMessagePort(connectionAttemptUuid, identityUrl)

  expect(wcpConnector.getConnection(tempInstanceId)).toBeDefined()

  const wcp5Response =
    new Promise<BrowserTypes.WebConnectionProtocol5ValidateAppIdentitySuccessResponse>(resolve => {
      appPort.onmessage = event => {
        resolve(event.data as BrowserTypes.WebConnectionProtocol5ValidateAppIdentitySuccessResponse)
      }
    })

  const wcp4Message: BrowserTypes.WebConnectionProtocol4ValidateAppIdentity = {
    type: "WCP4ValidateAppIdentity",
    meta: {
      connectionAttemptUuid,
      timestamp: new Date(),
    },
    payload: {
      identityUrl,
      actualUrl: identityUrl,
      ...(hostInstanceId ? { instanceId: hostInstanceId } : {}),
      ...(instanceUuid ? { instanceUuid } : {}),
    },
  }

  appPort.postMessage(wcp4Message)
  await flushAsyncDelivery()

  const resolvedWcp5 = await Promise.race([
    wcp5Response,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Timed out waiting for WCP5ValidateAppIdentityResponse")),
        5000
      )
    ),
  ])

  expect(resolvedWcp5.type).toBe("WCP5ValidateAppIdentityResponse")
  const canonicalInstanceId = resolvedWcp5.payload.instanceId
  expect(canonicalInstanceId).toBeTruthy()
  expect(resolvedWcp5.payload.appId).toBe(appId)

  await vi.waitFor(() => {
    expect(wcpConnector.getConnection(canonicalInstanceId)).toBeDefined()
    expect(wcpConnector.getConnection(tempInstanceId)).toBeUndefined()
  })

  return {
    connectionAttemptUuid,
    tempInstanceId,
    canonicalInstanceId,
    appPort,
    appId,
  }
}

export async function postDacpOnPort(
  appPort: MessagePort,
  message: BrowserTypes.AppRequestMessage
): Promise<void> {
  appPort.postMessage(message)
  await flushAsyncDelivery()
}

export function waitForPortMessage<T>(
  appPort: MessagePort,
  predicate: (data: unknown) => boolean,
  timeoutMs = 5000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Timed out waiting for MessagePort message")),
      timeoutMs
    )
    appPort.onmessage = event => {
      if (predicate(event.data)) {
        clearTimeout(timer)
        resolve(event.data as T)
      }
    }
  })
}

export const INSTRUMENT_CONTEXT: Context = {
  type: "fdc3.instrument",
  id: { ticker: "AAPL" },
}

export function createAddEventListenerMessage(
  instanceId: string,
  appId: string,
  eventType: BrowserTypes.AddEventListenerRequest["payload"]["type"]
): BrowserTypes.AddEventListenerRequest {
  return {
    type: "addEventListenerRequest",
    meta: {
      requestUuid: crypto.randomUUID(),
      timestamp: new Date(),
      source: { appId, instanceId },
    },
    payload: { type: eventType },
  }
}

export function createJoinUserChannelMessage(
  instanceId: string,
  appId: string,
  channelId: string
): BrowserTypes.JoinUserChannelRequest {
  return {
    type: "joinUserChannelRequest",
    meta: {
      requestUuid: crypto.randomUUID(),
      timestamp: new Date(),
      source: { appId, instanceId },
    },
    payload: { channelId },
  }
}

export function createAddContextListenerMessage(
  instanceId: string,
  appId: string,
  channelId: string | null,
  contextType: string
): BrowserTypes.AddContextListenerRequest {
  return {
    type: "addContextListenerRequest",
    meta: {
      requestUuid: crypto.randomUUID(),
      timestamp: new Date(),
      source: { appId, instanceId },
    },
    payload: { channelId, contextType },
  }
}

/** Generic user-channel listener (AOpensBWithContext3 / FINOS open-with-context path). */
export function createGenericContextListenerMessage(
  instanceId: string,
  appId: string
): BrowserTypes.AddContextListenerRequest {
  return createAddContextListenerMessage(instanceId, appId, null, "*")
}

export function createBroadcastMessage(
  instanceId: string,
  appId: string,
  channelId: string,
  context: Context
): BrowserTypes.BroadcastRequest {
  return {
    type: "broadcastRequest",
    meta: {
      requestUuid: crypto.randomUUID(),
      timestamp: new Date(),
      source: { appId, instanceId },
    },
    payload: { channelId, context },
  }
}

export function createOpenRequestMessage(
  sourceInstanceId: string,
  sourceAppId: string,
  targetAppId: string,
  context?: Context
): BrowserTypes.OpenRequest {
  return {
    type: "openRequest",
    meta: {
      requestUuid: crypto.randomUUID(),
      timestamp: new Date(),
      source: { appId: sourceAppId, instanceId: sourceInstanceId },
    },
    payload: {
      app: { appId: targetAppId },
      ...(context ? { context } : {}),
    },
  }
}

export function createGetOrCreateChannelMessage(
  instanceId: string,
  appId: string,
  channelId: string
): BrowserTypes.GetOrCreateChannelRequest {
  return {
    type: "getOrCreateChannelRequest",
    meta: {
      requestUuid: crypto.randomUUID(),
      timestamp: new Date(),
      source: { appId, instanceId },
    },
    payload: { channelId },
  }
}
