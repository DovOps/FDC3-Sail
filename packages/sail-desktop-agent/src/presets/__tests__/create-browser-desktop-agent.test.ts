/**
 * Browser Desktop Agent factory lifecycle tests.
 *
 * Verifies in-memory transport teardown on stop and that a fresh factory
 * instance can complete WCP handshake without stale transport state.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, afterEach, vi } from "vite-plus/test"
import type { BrowserTypes } from "@finos/fdc3"
import { createBrowserDesktopAgent } from "../create-browser-desktop-agent"
import type { DesktopAgent } from "../../core/desktop-agent"
import { getBrowserDesktopAgentSession } from "../browser-session"

function createWCP1Hello(connectionAttemptUuid: string): BrowserTypes.WebConnectionProtocol1Hello {
  const message = {
    type: "WCP1Hello",
    meta: {
      connectionAttemptUuid,
      timestamp: new Date().toISOString(),
    },
    payload: {
      identityUrl: "https://example.com/app",
      actualUrl: "https://example.com/app",
      fdc3Version: "2.2",
    },
  }

  return message as unknown as BrowserTypes.WebConnectionProtocol1Hello
}

function createMessageEvent(data: unknown, source: Window = window): MessageEvent {
  return new MessageEvent("message", {
    data,
    source,
    origin: "https://example.com",
  })
}

async function expectWCP3Handshake(connectionAttemptUuid: string): Promise<void> {
  const postMessageSpy = vi.spyOn(window, "postMessage")

  window.dispatchEvent(createMessageEvent(createWCP1Hello(connectionAttemptUuid)))
  await new Promise(resolve => setTimeout(resolve, 50))

  const calls = postMessageSpy.mock.calls as unknown as Array<
    [BrowserTypes.WebConnectionProtocol3Handshake, string, MessagePort[]]
  >
  expect(calls.length).toBeGreaterThan(0)

  const [handshakeMessage, targetOrigin, ports] = calls[0]
  expect(handshakeMessage.type).toBe("WCP3Handshake")
  expect(handshakeMessage.meta.connectionAttemptUuid).toBe(connectionAttemptUuid)
  expect(targetOrigin).toBe("https://example.com")
  expect(ports).toEqual(expect.arrayContaining([expect.any(MessagePort)]))

  postMessageSpy.mockRestore()
}

describe("createBrowserDesktopAgent lifecycle", () => {
  const activeAgents: DesktopAgent[] = []

  afterEach(() => {
    for (const agent of activeAgents.splice(0)) {
      agent.stop()
    }
  })

  it("completes WCP handshake after a previous agent was started and stopped", async () => {
    const firstAgent = createBrowserDesktopAgent({
      autoStart: false,
      wcpOptions: {
        getIntentResolverUrl: () => false,
        getChannelSelectorUrl: () => false,
        fdc3Version: "2.2",
      },
    })
    activeAgents.push(firstAgent)

    firstAgent.start()
    firstAgent.stop()

    const secondAgent = createBrowserDesktopAgent({
      autoStart: false,
      wcpOptions: {
        getIntentResolverUrl: () => false,
        getChannelSelectorUrl: () => false,
        fdc3Version: "2.2",
      },
    })
    activeAgents.push(secondAgent)

    secondAgent.start()

    await expectWCP3Handshake("reuse-after-stop-uuid")
    expect(getBrowserDesktopAgentSession(secondAgent).wcpConnector.getConnections()).toHaveLength(1)
  })

  it("allows stop then start on a new factory instance without stale in-memory transport", async () => {
    const sessionOne = createBrowserDesktopAgent({ autoStart: false })
    activeAgents.push(sessionOne)
    sessionOne.start()
    sessionOne.stop()

    const sessionTwo = createBrowserDesktopAgent({ autoStart: false })
    activeAgents.push(sessionTwo)
    sessionTwo.start()

    await expectWCP3Handshake("fresh-pair-uuid")

    expect(getBrowserDesktopAgentSession(sessionOne).wcpConnector.getIsStarted()).toBe(false)
    expect(getBrowserDesktopAgentSession(sessionTwo).wcpConnector.getIsStarted()).toBe(true)
    expect(getBrowserDesktopAgentSession(sessionTwo).wcpConnector.getConnections()).toHaveLength(1)
  })
})
