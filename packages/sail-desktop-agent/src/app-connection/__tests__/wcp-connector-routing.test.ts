/**
 * WCPConnector routing, lifecycle, and cleanup tests.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test"
import { WCPConnector } from "../wcp-connector"
import { createInMemoryTransportPair } from "../../transports/in-memory-transport"
import { getPendingWcpSourceWindowForTesting } from "../../core/handlers/dacp/wcp-pending-source-window"
import type { Transport } from "../../core/interfaces/transport"
import type { BrowserTypes } from "@finos/fdc3"
import {
  captureAppMessagePort,
  createMessageEvent,
  createWCP1Hello,
  establishTempConnection,
} from "./wcp-connector-test-helpers"

describe("WCPConnector routing and lifecycle", () => {
  let desktopAgentTransport: Transport
  let connector: WCPConnector

  beforeEach(() => {
    const [daTransport] = createInMemoryTransportPair()
    desktopAgentTransport = daTransport
  })

  afterEach(() => {
    if (connector?.getIsStarted()) {
      connector.stop()
    }
  })

  describe("message routing", () => {
    it("should route app messages to Desktop Agent with source metadata", async () => {
      connector = new WCPConnector(desktopAgentTransport)
      connector.start()

      const receivedMessages: unknown[] = []
      desktopAgentTransport.onMessage(msg => {
        receivedMessages.push(msg)
      })

      const wcp1Hello = createWCP1Hello("test-uuid")
      const event = createMessageEvent(wcp1Hello)
      window.dispatchEvent(event)

      await new Promise(resolve => setTimeout(resolve, 50))

      const connections = connector.getConnections()
      expect(connections).toHaveLength(1)

      connector.updateConnectionMetadata("temp-test-uuid", "actual-123", "app.test")

      desktopAgentTransport.send({
        type: "responseMessage",
        meta: {
          destination: {
            instanceId: "actual-123",
          },
        },
      })

      await new Promise(resolve => setTimeout(resolve, 50))

      expect(connections[0].port).toBeDefined()
    })

    it("should ignore messages without destination", async () => {
      connector = new WCPConnector(desktopAgentTransport)
      connector.start()

      const wcp1Hello = createWCP1Hello("test-uuid")
      const event = createMessageEvent(wcp1Hello)
      window.dispatchEvent(event)

      await new Promise(resolve => setTimeout(resolve, 50))

      connector.updateConnectionMetadata("temp-test-uuid", "actual-123", "app.test")

      desktopAgentTransport.send({
        type: "broadcastMessage",
        meta: {},
      })

      await new Promise(resolve => setTimeout(resolve, 50))

      expect(connector.getConnection("actual-123")).toBeDefined()
    })

    it("should not throw when routing to unknown app instance", async () => {
      connector = new WCPConnector(desktopAgentTransport)
      connector.start()

      expect(() => {
        desktopAgentTransport.send({
          type: "testMessage",
          meta: {
            destination: {
              instanceId: "nonexistent-app-123",
            },
          },
        })
      }).not.toThrow()

      await new Promise(resolve => setTimeout(resolve, 50))

      expect(connector.getIsStarted()).toBe(true)
    })

    it("should override spoofed WCP4 messageOrigin with handshake origin", async () => {
      connector = new WCPConnector(desktopAgentTransport)
      connector.start()

      const wcp1Hello = createWCP1Hello("origin-check-uuid")
      const event = createMessageEvent(wcp1Hello)
      window.dispatchEvent(event)

      await new Promise(resolve => setTimeout(resolve, 50))

      const connectorAccess = connector as unknown as {
        enrichMessageWithSource: (
          message: BrowserTypes.AppRequestMessage | BrowserTypes.WebConnectionProtocolMessage,
          instanceId: string
        ) => BrowserTypes.AppRequestMessage | BrowserTypes.WebConnectionProtocolMessage
      }

      const enriched = connectorAccess.enrichMessageWithSource(
        {
          type: "WCP4ValidateAppIdentity",
          payload: {
            identityUrl: "https://example.com/app",
            actualUrl: "https://example.com/app",
          },
          meta: {
            connectionAttemptUuid: "origin-check-uuid",
            timestamp: new Date().toISOString(),
            messageOrigin: "https://spoofed.example.com",
          },
        } as unknown as BrowserTypes.WebConnectionProtocolMessage,
        "temp-origin-check-uuid"
      ) as { meta?: { messageOrigin?: string } }

      expect(enriched.meta?.messageOrigin).toBe("https://example.com")
    })

    it("should register handshake source window for enriched WCP4 (not on message meta)", async () => {
      connector = new WCPConnector(desktopAgentTransport)
      connector.start()

      const handshakeSource = { postMessage: vi.fn() } as unknown as Window
      const wcp1Hello = createWCP1Hello("source-window-uuid")
      window.dispatchEvent(createMessageEvent(wcp1Hello, handshakeSource))

      await new Promise(resolve => setTimeout(resolve, 50))

      const connectorAccess = connector as unknown as {
        enrichMessageWithSource: (
          message: BrowserTypes.AppRequestMessage | BrowserTypes.WebConnectionProtocolMessage,
          instanceId: string
        ) => BrowserTypes.AppRequestMessage | BrowserTypes.WebConnectionProtocolMessage
      }

      const enriched = connectorAccess.enrichMessageWithSource(
        {
          type: "WCP4ValidateAppIdentity",
          payload: {
            identityUrl: "https://example.com/app",
            actualUrl: "https://example.com/app",
          },
          meta: {
            connectionAttemptUuid: "source-window-uuid",
            timestamp: new Date().toISOString(),
          },
        } as unknown as BrowserTypes.WebConnectionProtocolMessage,
        "temp-source-window-uuid"
      )

      expect(enriched.meta).not.toHaveProperty("wcpSourceWindow")

      expect(
        getPendingWcpSourceWindowForTesting(desktopAgentTransport, "temp-source-window-uuid")
      ).toBe(handshakeSource)
    })

    it("should disconnect temp connection after WCP5 identity validation failure", async () => {
      connector = new WCPConnector(desktopAgentTransport)
      const appDisconnectedHandler = vi.fn()
      connector.on("appDisconnected", appDisconnectedHandler)
      connector.start()

      const wcp1Hello = createWCP1Hello("failure-disconnect-uuid")
      window.dispatchEvent(createMessageEvent(wcp1Hello))

      await new Promise(resolve => setTimeout(resolve, 50))
      expect(connector.getConnection("temp-failure-disconnect-uuid")).toBeDefined()

      const connectorAccess = connector as unknown as {
        handleDesktopAgentMessage: (message: unknown) => void
      }
      connectorAccess.handleDesktopAgentMessage({
        type: "WCP5ValidateAppIdentityFailedResponse",
        payload: { message: "Origin mismatch" },
        meta: {
          connectionAttemptUuid: "failure-disconnect-uuid",
          timestamp: new Date().toISOString(),
          destination: { instanceId: "temp-failure-disconnect-uuid" },
        },
      })

      await new Promise(resolve => setTimeout(resolve, 50))
      expect(connector.getConnection("temp-failure-disconnect-uuid")).toBeUndefined()
      expect(appDisconnectedHandler).toHaveBeenCalledTimes(1)
      expect(appDisconnectedHandler).toHaveBeenCalledWith("temp-failure-disconnect-uuid")
    })
  })

  describe("updateConnectionMetadata", () => {
    it("should update connection with validated info", async () => {
      connector = new WCPConnector(desktopAgentTransport)
      connector.start()

      const wcp1Hello = createWCP1Hello("test-uuid")
      const event = createMessageEvent(wcp1Hello)
      window.dispatchEvent(event)

      await new Promise(resolve => setTimeout(resolve, 50))

      expect(connector.getConnection("temp-test-uuid")).toBeDefined()

      connector.updateConnectionMetadata(
        "temp-test-uuid",
        "actual-instance-123",
        "app.example.test"
      )

      expect(connector.getConnection("temp-test-uuid")).toBeUndefined()
      expect(connector.getConnection("actual-instance-123")).toBeDefined()

      const connection = connector.getConnection("actual-instance-123")!
      expect(connection.instanceId).toBe("actual-instance-123")
      expect(connection.appId).toBe("app.example.test")
      expect(connection.connectionAttemptUuid).toBe("test-uuid")
    })

    it("should warn if temp instanceId not found", () => {
      connector = new WCPConnector(desktopAgentTransport)
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

      connector.updateConnectionMetadata("nonexistent-id", "actual-123", "app.test")

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Cannot update connection metadata: temp instanceId nonexistent-id not found"
        )
      )

      consoleWarnSpy.mockRestore()
    })

    it("should migrate transport reference to new instanceId", async () => {
      connector = new WCPConnector(desktopAgentTransport)
      connector.start()

      const wcp1Hello = createWCP1Hello("test-uuid")
      const event = createMessageEvent(wcp1Hello)
      window.dispatchEvent(event)

      await new Promise(resolve => setTimeout(resolve, 50))

      connector.updateConnectionMetadata("temp-test-uuid", "actual-123", "app.test")

      desktopAgentTransport.send({
        type: "testMessage",
        meta: {
          destination: { instanceId: "actual-123" },
        },
      })

      await new Promise(resolve => setTimeout(resolve, 50))

      expect(connector.getConnection("actual-123")).toBeDefined()
    })
  })

  describe("getters", () => {
    it("should return all connections", async () => {
      connector = new WCPConnector(desktopAgentTransport)
      connector.start()

      expect(connector.getConnections()).toEqual([])

      const wcp1Hello1 = createWCP1Hello("uuid-1")
      const wcp1Hello2 = createWCP1Hello("uuid-2")

      window.dispatchEvent(createMessageEvent(wcp1Hello1))
      window.dispatchEvent(createMessageEvent(wcp1Hello2))

      await new Promise(resolve => setTimeout(resolve, 50))

      const connections = connector.getConnections()
      expect(connections).toHaveLength(2)
      expect(connections[0].connectionAttemptUuid).toBe("uuid-1")
      expect(connections[1].connectionAttemptUuid).toBe("uuid-2")
    })

    it("should return specific connection by instanceId", async () => {
      connector = new WCPConnector(desktopAgentTransport)
      connector.start()

      const wcp1Hello = createWCP1Hello("test-uuid")
      window.dispatchEvent(createMessageEvent(wcp1Hello))

      await new Promise(resolve => setTimeout(resolve, 50))

      const connection = connector.getConnection("temp-test-uuid")
      expect(connection).toBeDefined()
      expect(connection!.instanceId).toBe("temp-test-uuid")

      expect(connector.getConnection("nonexistent")).toBeUndefined()
    })

    it("should return started status", () => {
      connector = new WCPConnector(desktopAgentTransport)

      expect(connector.getIsStarted()).toBe(false)

      connector.start()
      expect(connector.getIsStarted()).toBe(true)

      connector.stop()
      expect(connector.getIsStarted()).toBe(false)
    })
  })

  describe("appDisconnected exactly once (owner-initiated disconnect)", () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it("emits appDisconnected exactly once when connector.stop() cleans up one connection", async () => {
      connector = new WCPConnector(desktopAgentTransport)
      const appDisconnectedHandler = vi.fn()
      connector.on("appDisconnected", appDisconnectedHandler)
      connector.start()

      const instanceId = await establishTempConnection(connector, "stop-single-uuid")
      connector.stop()

      expect(appDisconnectedHandler).toHaveBeenCalledTimes(1)
      expect(appDisconnectedHandler).toHaveBeenCalledWith(instanceId)
    })

    it("emits appDisconnected exactly once per instance when connector.stop() cleans up multiple connections", async () => {
      connector = new WCPConnector(desktopAgentTransport)
      const appDisconnectedHandler = vi.fn()
      connector.on("appDisconnected", appDisconnectedHandler)
      connector.start()

      window.dispatchEvent(createMessageEvent(createWCP1Hello("stop-multi-1")))
      window.dispatchEvent(createMessageEvent(createWCP1Hello("stop-multi-2")))
      await new Promise(resolve => setTimeout(resolve, 50))

      connector.stop()

      expect(appDisconnectedHandler).toHaveBeenCalledTimes(2)
      expect(appDisconnectedHandler).toHaveBeenCalledWith("temp-stop-multi-1")
      expect(appDisconnectedHandler).toHaveBeenCalledWith("temp-stop-multi-2")
    })

    it("emits appDisconnected exactly once when disconnectAppByInstanceId is called", async () => {
      connector = new WCPConnector(desktopAgentTransport)
      const appDisconnectedHandler = vi.fn()
      connector.on("appDisconnected", appDisconnectedHandler)
      connector.start()

      const instanceId = await establishTempConnection(connector, "explicit-disconnect-uuid")
      connector.disconnectAppByInstanceId(instanceId)

      expect(appDisconnectedHandler).toHaveBeenCalledTimes(1)
      expect(appDisconnectedHandler).toHaveBeenCalledWith(instanceId)
    })

    it("emits appDisconnected exactly once after WCP4 handshake timeout", async () => {
      vi.useFakeTimers()
      try {
        connector = new WCPConnector(desktopAgentTransport, { handshakeTimeout: 1000 })
        const appDisconnectedHandler = vi.fn()
        connector.on("appDisconnected", appDisconnectedHandler)
        connector.start()

        window.dispatchEvent(createMessageEvent(createWCP1Hello("handshake-timeout-uuid")))
        await vi.advanceTimersByTimeAsync(50)

        expect(connector.getConnection("temp-handshake-timeout-uuid")).toBeDefined()
        await vi.advanceTimersByTimeAsync(1000)

        expect(appDisconnectedHandler).toHaveBeenCalledTimes(1)
        expect(appDisconnectedHandler).toHaveBeenCalledWith("temp-handshake-timeout-uuid")
      } finally {
        vi.useRealTimers()
      }
    })

    it("emits appDisconnected exactly once after WCP6Goodbye grace period", async () => {
      vi.useFakeTimers()
      try {
        connector = new WCPConnector(desktopAgentTransport, {
          handshakeTimeout: 60_000,
          disconnectGracePeriod: 500,
        })
        const appDisconnectedHandler = vi.fn()
        connector.on("appDisconnected", appDisconnectedHandler)
        connector.start()

        const appPort = captureAppMessagePort("goodbye-grace-uuid")
        await vi.advanceTimersByTimeAsync(50)

        appPort.postMessage({
          type: "WCP6Goodbye",
          meta: { timestamp: new Date().toISOString() },
        })
        await vi.advanceTimersByTimeAsync(50)

        expect(appDisconnectedHandler).not.toHaveBeenCalled()
        await vi.advanceTimersByTimeAsync(500)

        expect(appDisconnectedHandler).toHaveBeenCalledTimes(1)
        expect(appDisconnectedHandler).toHaveBeenCalledWith("temp-goodbye-grace-uuid")
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe("cleanup", () => {
    it("should disconnect all apps when stopping", async () => {
      connector = new WCPConnector(desktopAgentTransport)
      connector.start()

      window.dispatchEvent(createMessageEvent(createWCP1Hello("uuid-1")))
      window.dispatchEvent(createMessageEvent(createWCP1Hello("uuid-2")))

      await new Promise(resolve => setTimeout(resolve, 50))

      expect(connector.getConnections()).toHaveLength(2)

      connector.stop()

      expect(connector.getConnections()).toHaveLength(0)
    })

    it("should handle disconnection gracefully", async () => {
      connector = new WCPConnector(desktopAgentTransport)
      connector.start()

      const wcp1Hello = createWCP1Hello("test-uuid")
      window.dispatchEvent(createMessageEvent(wcp1Hello))

      await new Promise(resolve => setTimeout(resolve, 50))

      expect(connector.getConnection("temp-test-uuid")).toBeDefined()

      expect(() => connector.stop()).not.toThrow()
      expect(connector.getConnections()).toHaveLength(0)
    })
  })

  describe("invalid messages", () => {
    it("should not throw when receiving invalid messages", async () => {
      connector = new WCPConnector(desktopAgentTransport)
      connector.start()

      expect(() => {
        desktopAgentTransport.send("invalid")
      }).not.toThrow()

      expect(() => {
        desktopAgentTransport.send(null)
      }).not.toThrow()

      expect(() => {
        desktopAgentTransport.send(undefined)
      }).not.toThrow()

      await new Promise(resolve => setTimeout(resolve, 50))

      expect(connector.getIsStarted()).toBe(true)
    })
  })
})
