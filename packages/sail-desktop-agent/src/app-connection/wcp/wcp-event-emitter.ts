import type { WCPConnectorEvents } from "../wcp-connector-events"
import { consoleLogger } from "../../core/interfaces/logger"

export class WCPEventEmitter {
  private handlers: { [K in keyof WCPConnectorEvents]?: Set<WCPConnectorEvents[K]> } = {}

  /**
   * Register an event handler
   *
   * @param event - Event name
   * @param handler - Event handler function
   */
  on<EventName extends keyof WCPConnectorEvents>(
    event: EventName,
    handler: WCPConnectorEvents[EventName]
  ): void {
    if (!this.handlers[event]) {
      // Type assertion needed: TypeScript can't infer the relationship between
      // generic EventName and the mapped type in handlers
      ;(this.handlers as Record<EventName, Set<WCPConnectorEvents[EventName]>>)[event] = new Set()
    }
    this.handlers[event]!.add(handler)
  }

  /**
   * Remove an event handler
   *
   * @param event - Event name
   * @param handler - Event handler function
   */
  off<EventName extends keyof WCPConnectorEvents>(
    event: EventName,
    handler: WCPConnectorEvents[EventName]
  ): void {
    this.handlers[event]?.delete(handler)
  }

  /**
   * Emit an event to all registered handlers
   */
  protected emit<EventName extends keyof WCPConnectorEvents>(
    event: EventName,
    ...args: Parameters<WCPConnectorEvents[EventName]>
  ): void {
    const handlers = this.handlers[event]
    if (!handlers) {
      return
    }

    for (const handler of handlers) {
      try {
        ;(handler as (...args: Parameters<WCPConnectorEvents[EventName]>) => void)(...args)
      } catch (error) {
        consoleLogger.error(`Error in ${event} handler:`, error)
      }
    }
  }
}
