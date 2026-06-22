/**
 * WCPConnector Tests
 *
 * Tests the WCP (Web Connection Protocol) connector that handles browser-side
 * FDC3 app connections via MessagePorts and window.postMessage.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test"
import { WCPConnector } from "../wcp-connector"
import { createInMemoryTransportPair } from "../../transports/in-memory-transport"
import type { Transport } from "../../core/interfaces/transport"
import type { BrowserTypes } from "@finos/fdc3"
import { createMessageEvent, createWCP1Hello } from "./wcp-connector-test-helpers"

describe("WCPConnector", () => {
  let desktopAgentTransport: Transport
  let connector: WCPConnector

  beforeEach(() => {
    // Create a transport pair for Desktop Agent communication
    const [daTransport] = createInMemoryTransportPair()
    desktopAgentTransport = daTransport
  })

  afterEach(() => {
    // Clean up connector if it was started
    if (connector?.getIsStarted()) {
      connector.stop()
    }
  })

  describe("constructor", () => {
    it("should create connector with default options", () => {
      connector = new WCPConnector(desktopAgentTransport)

      expect(connector).toBeInstanceOf(WCPConnector)
      expect(connector.getIsStarted()).toBe(false)
      expect(connector.getConnections()).toEqual([])
    })

    it("should accept custom options", () => {
      const options = {
        getIntentResolverUrl: (instanceId: string) => `/resolver?id=${instanceId}`,
        getChannelSelectorUrl: (instanceId: string) => `/selector?id=${instanceId}`,
        fdc3Version: "2.2",
        handshakeTimeout: 10000,
      }

      connector = new WCPConnector(desktopAgentTransport, options)

      expect(connector).toBeInstanceOf(WCPConnector)
    })

    it("should use false for UI URLs by default", () => {
      connector = new WCPConnector(desktopAgentTransport)

      // This will be tested indirectly via WCP3Handshake response
      expect(connector).toBeInstanceOf(WCPConnector)
    })
  })

  describe("start/stop", () => {
    it("should start listening for window messages", () => {
      connector = new WCPConnector(desktopAgentTransport)
      const addEventListenerSpy = vi.spyOn(window, "addEventListener")

      connector.start()

      expect(connector.getIsStarted()).toBe(true)
      expect(addEventListenerSpy).toHaveBeenCalledWith("message", expect.any(Function))

      addEventListenerSpy.mockRestore()
    })

    it("should throw if started twice", () => {
      connector = new WCPConnector(desktopAgentTransport)

      connector.start()

      expect(() => connector.start()).toThrow("WCPConnector is already started")
    })

    it("should throw if window is not available", () => {
      // Save original window
      const originalWindow = global.window

      // @ts-expect-error - Testing runtime check
      delete global.window

      connector = new WCPConnector(desktopAgentTransport)

      expect(() => connector.start()).toThrow("WCPConnector requires browser environment")

      // Restore window
      global.window = originalWindow
    })

    it("should stop and clean up connections", () => {
      connector = new WCPConnector(desktopAgentTransport)
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener")

      connector.start()
      connector.stop()

      expect(connector.getIsStarted()).toBe(false)
      expect(removeEventListenerSpy).toHaveBeenCalledWith("message", expect.any(Function))
      expect(connector.getConnections()).toEqual([])

      removeEventListenerSpy.mockRestore()
    })

    it("should be idempotent when stopping", () => {
      connector = new WCPConnector(desktopAgentTransport)

      connector.start()
      connector.stop()
      connector.stop() // Should not throw

      expect(connector.getIsStarted()).toBe(false)
    })
  })

  describe("WCP1Hello handling", () => {
    it("should handle WCP1Hello and send WCP3Handshake", () => {
      return new Promise<void>(resolve => {
        connector = new WCPConnector(desktopAgentTransport, {
          getIntentResolverUrl: instanceId => `/resolver?id=${instanceId}`,
          getChannelSelectorUrl: instanceId => `/selector?id=${instanceId}`,
          fdc3Version: "2.2",
        })

        // Mock window.postMessage to capture WCP3Handshake
        const postMessageSpy = vi.spyOn(window, "postMessage")

        connector.start()

        // Simulate WCP1Hello from an app iframe
        const wcp1Hello = createWCP1Hello("test-connection-uuid")
        const event = createMessageEvent(wcp1Hello)

        window.dispatchEvent(event)

        // Wait for async handling
        setTimeout(() => {
          const calls = postMessageSpy.mock.calls as unknown as Array<
            [BrowserTypes.WebConnectionProtocol3Handshake, string, MessagePort[]]
          >
          expect(calls.length).toBeGreaterThan(0)

          const [handshakeMessage, targetOrigin, ports] = calls[0]
          expect(handshakeMessage.type).toBe("WCP3Handshake")
          expect(handshakeMessage.meta.connectionAttemptUuid).toBe("test-connection-uuid")
          expect(handshakeMessage.payload.fdc3Version).toBe("2.2")
          expect(handshakeMessage.payload.intentResolverUrl).toContain("/resolver")
          expect(handshakeMessage.payload.channelSelectorUrl).toContain("/selector")
          expect(targetOrigin).toBe("https://example.com")
          expect(ports).toEqual(expect.arrayContaining([expect.any(MessagePort)]))

          postMessageSpy.mockRestore()
          resolve()
        }, 50)
      })
    })

    it("should ignore non-WCP1Hello messages", () => {
      connector = new WCPConnector(desktopAgentTransport)
      const postMessageSpy = vi.spyOn(window, "postMessage")

      connector.start()

      // Send non-WCP message
      const event = createMessageEvent({ type: "SomeOtherMessage" })
      window.dispatchEvent(event)

      // Should not respond
      expect(postMessageSpy).not.toHaveBeenCalled()

      postMessageSpy.mockRestore()
    })

    it("should ignore WCP1Hello with null source", () => {
      connector = new WCPConnector(desktopAgentTransport)
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

      connector.start()

      // Create event with null source
      const wcp1Hello = createWCP1Hello()
      const event = new MessageEvent("message", {
        data: wcp1Hello,
        source: null,
        origin: "https://example.com",
      })

      window.dispatchEvent(event)

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("WCP1Hello received from null source, ignoring")
      )

      consoleWarnSpy.mockRestore()
    })

    it("should create temporary instanceId for new connections", () => {
      return new Promise<void>(resolve => {
        connector = new WCPConnector(desktopAgentTransport)
        connector.start()

        const wcp1Hello = createWCP1Hello("my-connection-uuid")
        const event = createMessageEvent(wcp1Hello)

        window.dispatchEvent(event)

        setTimeout(() => {
          const connections = connector.getConnections()
          expect(connections).toHaveLength(1)
          expect(connections[0].instanceId).toBe("temp-my-connection-uuid")
          expect(connections[0].connectionAttemptUuid).toBe("my-connection-uuid")
          expect(connections[0].appId).toBe("unknown")

          resolve()
        }, 50)
      })
    })

    it("should use false for UI URLs when not provided", () => {
      return new Promise<void>(resolve => {
        connector = new WCPConnector(desktopAgentTransport)
        const postMessageSpy = vi.spyOn(window, "postMessage")

        connector.start()

        const wcp1Hello = createWCP1Hello()
        const event = createMessageEvent(wcp1Hello)

        window.dispatchEvent(event)

        setTimeout(() => {
          const calls = postMessageSpy.mock.calls as unknown as Array<
            [BrowserTypes.WebConnectionProtocol3Handshake, string, MessagePort[]]
          >
          expect(calls.length).toBeGreaterThan(0)

          const [handshakeMessage, targetOrigin] = calls[0]
          expect(handshakeMessage.payload.intentResolverUrl).toBe(false)
          expect(handshakeMessage.payload.channelSelectorUrl).toBe(false)
          expect(targetOrigin).toBe("https://example.com")

          postMessageSpy.mockRestore()
          resolve()
        }, 50)
      })
    })
  })

  describe("event handlers", () => {
    it("should emit appConnected event after validation", () => {
      connector = new WCPConnector(desktopAgentTransport)
      const appConnectedHandler = vi.fn()

      connector.on("appConnected", appConnectedHandler)
      connector.start()

      // Simulate connection and validation
      const wcp1Hello = createWCP1Hello("test-uuid")
      const event = createMessageEvent(wcp1Hello)
      window.dispatchEvent(event)

      // Simulate validation completing
      connector.updateConnectionMetadata(
        "temp-test-uuid",
        "actual-instance-123",
        "app.example.test"
      )

      expect(appConnectedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          instanceId: "actual-instance-123",
          appId: "app.example.test",
          connectionAttemptUuid: "test-uuid",
        })
      )
    })

    it("should emit appDisconnected event when app disconnects", async () => {
      connector = new WCPConnector(desktopAgentTransport)
      const appDisconnectedHandler = vi.fn()

      connector.on("appDisconnected", appDisconnectedHandler)
      connector.start()

      // Create connection
      const wcp1Hello = createWCP1Hello("test-uuid")
      const event = createMessageEvent(wcp1Hello)
      window.dispatchEvent(event)

      await new Promise(resolve => setTimeout(resolve, 50))

      // Get the connection and manually trigger disconnect
      // (In real usage, MessagePortTransport listens to port 'messageerror' and 'close' events)
      const connections = connector.getConnections()
      const instanceId = connections[0].instanceId

      // Manually trigger the disconnect by calling stop() which cleans up connections
      connector.stop()

      expect(appDisconnectedHandler).toHaveBeenCalledTimes(1)
      expect(appDisconnectedHandler).toHaveBeenCalledWith(instanceId)
    })

    it("should emit handshakeFailed event on error", () => {
      connector = new WCPConnector(desktopAgentTransport)
      const handshakeFailedHandler = vi.fn()

      connector.on("handshakeFailed", handshakeFailedHandler)
      connector.start()

      // Mock MessageChannel to throw
      const originalMessageChannel = global.MessageChannel
      class FailingMessageChannel {
        constructor() {
          throw new Error("MessageChannel creation failed")
        }
      }
      global.MessageChannel = FailingMessageChannel as unknown as typeof MessageChannel

      const wcp1Hello = createWCP1Hello("error-uuid")
      const event = createMessageEvent(wcp1Hello)
      window.dispatchEvent(event)

      expect(handshakeFailedHandler).toHaveBeenCalledWith(expect.any(Error), "error-uuid")

      // Restore MessageChannel
      global.MessageChannel = originalMessageChannel
    })

    it("should handle errors in event handlers gracefully", () => {
      connector = new WCPConnector(desktopAgentTransport)
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

      connector.on("appConnected", () => {
        throw new Error("Handler error")
      })

      connector.start()

      const wcp1Hello = createWCP1Hello("test-uuid")
      const event = createMessageEvent(wcp1Hello)
      window.dispatchEvent(event)

      connector.updateConnectionMetadata("temp-test-uuid", "actual-123", "app.test")

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[DACP ERROR] Error in appConnected handler:",
        expect.any(Error)
      )

      consoleErrorSpy.mockRestore()
    })

    it("should support removing event handlers", () => {
      connector = new WCPConnector(desktopAgentTransport)
      const handler = vi.fn()

      connector.on("appConnected", handler)
      connector.off("appConnected", handler)

      connector.start()

      const wcp1Hello = createWCP1Hello("test-uuid")
      const event = createMessageEvent(wcp1Hello)
      window.dispatchEvent(event)

      connector.updateConnectionMetadata("temp-test-uuid", "actual-123", "app.test")

      expect(handler).not.toHaveBeenCalled()
    })
  })
})
