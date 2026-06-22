import { createDACPSuccessResponse, createDACPEvent } from "../../dacp/dacp-message-creators"
import { type DACPHandlerContext } from "../types"
import { sendDACPResponse, sendDACPErrorResponse } from "./utils/dacp-response-utils"
import type { BrowserTypes, Context } from "@finos/fdc3"
import { ChannelError } from "@finos/fdc3"
import {
  FDC3ChannelError,
  NoChannelFoundError,
  ChannelAccessDeniedError,
  ListenerNotFoundChannelError,
} from "../../errors/fdc3-errors"
import {
  getAppChannel,
  getChannelContext,
  getInstance,
  getPrivateChannel,
  getStoredContext,
  getUserChannel,
  instanceContextListenerMatchesBroadcast,
} from "../../state/selectors"
import {
  storeContext,
  addContextListener,
  joinUserChannel,
  removeContextListener,
  addPrivateChannelContextListener,
  removePrivateChannelContextListener,
  setPrivateChannelLastContext,
  connectInstanceToPrivateChannel,
} from "../../state/mutators"
import { generateEventUuid } from "../../dacp/dacp-utils"
import {
  notifyPrivateChannelAddContextListener,
  notifyPrivateChannelUnsubscribe,
} from "./private-channel-handlers"
import { notifyContextListenerAdded } from "./utils/open-with-context"
import { resolveDacpHandlerInstanceId } from "./utils/resolve-context-listener-instance-id"
import { isValidContext } from "./utils/context-validation"

/**
 * Handles broadcast requests to send context to a channel
 * Implements DACP broadcastRequest message handling
 *
 * Note: Message validation happens at router level before this handler is called
 */
export function handleBroadcastRequest(
  message: BrowserTypes.BroadcastRequest,
  context: DACPHandlerContext
): void {
  const { responses, getState, setState, logger } = context
  const instanceId = resolveDacpHandlerInstanceId(message, context)
  const handlerContext = { ...context, instanceId }

  try {
    const { channelId: payloadChannelId, context: broadcastContext } = message.payload

    if (!isValidContext(broadcastContext)) {
      sendDACPErrorResponse({
        message,
        errorType: ChannelError.MalformedContext,
        errorMessage: "Invalid context: context must be an object with a string type property",
        instanceId,
        responses,
      })
      return
    }

    // Validate that the instance is a member of the channel they're broadcasting to
    const state = getState()
    const instance = getInstance(state, instanceId)
    if (!instance) {
      throw new Error("Instance not found")
    }

    const channelId = payloadChannelId ?? instance.currentUserChannel
    if (!channelId) {
      // No channel specified and app not joined - no-op per spec
      const response = createDACPSuccessResponse(message, "broadcastResponse")
      sendDACPResponse({ response, instanceId, responses })
      return
    }

    const userChannel = getUserChannel(state, channelId)
    const appChannel = getAppChannel(state, channelId)
    const privateChannel = getPrivateChannel(state, channelId)
    if (!userChannel && !appChannel && !privateChannel) {
      throw new NoChannelFoundError(`Channel ${channelId} does not exist`)
    }

    if (userChannel && instance.currentUserChannel !== channelId && !payloadChannelId) {
      // No-op for DesktopAgent.broadcast when not joined to a user channel.
      const response = createDACPSuccessResponse(message, "broadcastResponse")
      sendDACPResponse({ response, instanceId, responses })
      return
    }

    logger.info("DACP: Processing broadcast request", {
      channelId,
      contextType: broadcastContext.type,
      requestUuid: message.meta.requestUuid,
    })

    // Store context using state transform (skip for private channels)
    if (!privateChannel) {
      setState(state => storeContext(state, channelId, broadcastContext, instanceId))
    }

    if (privateChannel) {
      if (!privateChannel.connectedInstances.includes(instanceId)) {
        throw new ChannelAccessDeniedError(
          `Instance ${instanceId} is not connected to private channel ${channelId}`
        )
      }

      setState(state =>
        setPrivateChannelLastContext(state, channelId, broadcastContext.type, broadcastContext)
      )
      notifyPrivateChannelContextListeners(channelId, broadcastContext, handlerContext)
    } else {
      notifyContextListeners(channelId, broadcastContext, handlerContext)
    }

    const response = createDACPSuccessResponse(message, "broadcastResponse")

    sendDACPResponse({ response, instanceId, responses })

    logger.debug("DACP: Broadcast request completed successfully", {
      requestUuid: message.meta.requestUuid,
    })
  } catch (error) {
    logger.error("DACP: Broadcast request failed", error)

    // BroadcastResponse schema doesn't validate error payloads, but use ChannelError for consistency
    // Common errors: MalformedContext, ApiTimeout
    const errorType = error instanceof FDC3ChannelError ? error.errorType : ChannelError.ApiTimeout
    const errorMessage = error instanceof Error ? error.message : "Unknown broadcast error"

    sendDACPErrorResponse({
      message,
      errorType,
      errorMessage,
      instanceId,
      responses,
    })
  }
}

/**
 * Handles add context listener requests
 * Implements DACP addContextListenerRequest message handling
 */
export function handleAddContextListener(
  message: BrowserTypes.AddContextListenerRequest,
  context: DACPHandlerContext
): void {
  const { responses, getState, setState, logger } = context
  const instanceId = resolveDacpHandlerInstanceId(message, context)

  try {
    const { channelId, contextType: payloadContextType } = message.payload
    const contextType = payloadContextType ?? "*" // Default to all contexts if not specified

    if (channelId) {
      const state = getState()
      const userChannel = getUserChannel(state, channelId)
      const appChannel = getAppChannel(state, channelId)
      const privateChannel = getPrivateChannel(state, channelId)

      if (!userChannel && !appChannel && !privateChannel) {
        throw new NoChannelFoundError(`Channel ${channelId} does not exist`)
      }

      if (userChannel) {
        setState(state => joinUserChannel(state, instanceId, channelId))
      }

      if (privateChannel) {
        const privateContextType = payloadContextType ?? null
        const listenerId = generateEventUuid()
        const resolvedContextType = privateContextType === "*" ? null : privateContextType

        if (!privateChannel.connectedInstances.includes(instanceId)) {
          setState(state => connectInstanceToPrivateChannel(state, channelId, instanceId))
        }

        setState(state =>
          addPrivateChannelContextListener(
            state,
            channelId,
            listenerId,
            instanceId,
            resolvedContextType
          )
        )

        notifyPrivateChannelAddContextListener(channelId, instanceId, resolvedContextType, context)

        const response = createDACPSuccessResponse(message, "addContextListenerResponse", {
          listenerUUID: listenerId,
        })

        sendDACPResponse({ response, instanceId, responses })
        return
      }
    }

    logger.info("DACP: Adding context listener", {
      instanceId,
      contextType,
      requestUuid: message.meta.requestUuid,
    })

    const listenerId = message.meta.requestUuid

    // Add context listener using state transform
    setState(state =>
      addContextListener(state, instanceId, listenerId, contextType, message.payload.channelId)
    )

    notifyContextListenerAdded(instanceId, contextType, context)

    logger.info("DACP: Context listener registration result", {
      instanceId,
      contextType,
      listenerId,
      added: true,
      requestUuid: message.meta.requestUuid,
    })

    const response = createDACPSuccessResponse(message, "addContextListenerResponse", {
      listenerUUID: listenerId,
    })

    sendDACPResponse({ response, instanceId, responses })

    logger.debug("DACP: Context listener added successfully", {
      listenerUUID: listenerId,
      instanceId,
      requestUuid: message.meta.requestUuid,
    })

    const stateAfterListener = getState()
    const requestedChannelId = message.payload.channelId
    if (requestedChannelId && getUserChannel(stateAfterListener, requestedChannelId)) {
      deliverCurrentContextToListener(instanceId, requestedChannelId, contextType, context)
    } else if (!requestedChannelId) {
      const inst = getInstance(stateAfterListener, instanceId)
      const uc = inst?.currentUserChannel
      if (uc && getUserChannel(stateAfterListener, uc)) {
        deliverCurrentContextToListener(instanceId, uc, contextType, context)
      }
    }
  } catch (error) {
    logger.error("DACP: Add context listener failed", error)

    const errorType = error instanceof FDC3ChannelError ? error.errorType : ChannelError.ApiTimeout
    const errorMessage = error instanceof Error ? error.message : "Failed to add context listener"

    sendDACPErrorResponse({
      message,
      errorType,
      errorMessage,
      instanceId,
      responses,
    })
  }
}

/**
 * Handles context listener unsubscribe requests
 * Implements DACP contextListenerUnsubscribeRequest message handling
 */
export function handleContextListenerUnsubscribe(
  message: BrowserTypes.ContextListenerUnsubscribeRequest,
  context: DACPHandlerContext
): void {
  const { responses, getState, setState, logger } = context
  const instanceId = resolveDacpHandlerInstanceId(message, context)

  try {
    const { listenerUUID } = message.payload

    logger.info("DACP: Unsubscribing context listener", {
      listenerUUID,
      instanceId,
      requestUuid: message.meta?.requestUuid,
    })

    const state = getState()
    const instance = getInstance(state, instanceId)
    const hasInstanceListener = !!instance && !!instance.contextListeners[listenerUUID]

    if (hasInstanceListener) {
      setState(state => removeContextListener(state, instanceId, listenerUUID))
    } else {
      const privateChannels = Object.values(state.channels.private)
      const privateChannelWithListener = privateChannels.find(
        channel => channel.contextListeners[listenerUUID]
      )

      if (!privateChannelWithListener) {
        throw new ListenerNotFoundChannelError(
          `Context listener ${listenerUUID} not found for instance ${instanceId}`
        )
      }

      const privateListener = privateChannelWithListener.contextListeners[listenerUUID]
      if (privateListener.instanceId !== instanceId) {
        throw new ListenerNotFoundChannelError(
          `Context listener ${listenerUUID} not found for instance ${instanceId}`
        )
      }

      setState(state =>
        removePrivateChannelContextListener(state, privateChannelWithListener.id, listenerUUID)
      )
      notifyPrivateChannelUnsubscribe(
        privateChannelWithListener.id,
        listenerUUID,
        privateListener.contextType,
        instanceId,
        context
      )
    }

    const response = createDACPSuccessResponse(message, "contextListenerUnsubscribeResponse")

    sendDACPResponse({ response, instanceId, responses })

    logger.debug("DACP: Context listener unsubscribed successfully", {
      listenerUUID,
      instanceId,
      requestUuid: message.meta?.requestUuid,
    })
  } catch (error) {
    logger.error("DACP: Context listener unsubscribe failed", error)

    const errorType = error instanceof FDC3ChannelError ? error.errorType : ChannelError.ApiTimeout
    const errorMessage =
      error instanceof Error ? error.message : "Failed to unsubscribe context listener"

    sendDACPErrorResponse({
      message,
      errorType,
      errorMessage,
      instanceId,
      responses,
    })
  }
}

function notifyContextListeners(
  channelId: string,
  context: Context,
  handlerContext: DACPHandlerContext
): void {
  const { getState, logger, logPayloadDetail } = handlerContext
  const resolvedLogPayloadDetail = logPayloadDetail ?? "metadata"
  const state = getState()
  const userChannel = getUserChannel(state, channelId)
  const appChannel = getAppChannel(state, channelId)

  const instancesOnChannel = userChannel
    ? Object.values(state.instances).filter(
        instance =>
          instance.currentUserChannel === channelId &&
          Object.values(instance.contextListeners).some(
            listener =>
              instanceContextListenerMatchesBroadcast(listener, context.type) &&
              (listener.channelId === undefined || listener.channelId === channelId)
          )
      )
    : appChannel
      ? Object.values(state.instances).filter(instance =>
          Object.values(instance.contextListeners).some(
            listener =>
              listener.channelId === channelId &&
              instanceContextListenerMatchesBroadcast(listener, context.type)
          )
        )
      : []

  logger.info("DACP: Notifying context listeners", {
    channelId,
    contextType: context.type,
    totalInstancesOnChannel: instancesOnChannel.length,
    instanceIds: instancesOnChannel.map(i => i.instanceId),
  })

  const targets = instancesOnChannel.filter(instance => {
    if (instance.instanceId === handlerContext.instanceId) {
      logger.debug("Skipping sender instance", { instanceId: instance.instanceId })
      return false
    }
    return true
  })

  let successful = 0
  let failed = 0

  targets.forEach(instance => {
    try {
      const senderInstance = getInstance(getState(), handlerContext.instanceId)

      const broadcastEvent = createDACPEvent("broadcastEvent", {
        channelId,
        context,
        originatingApp: {
          appId: senderInstance?.appId || "unknown",
          instanceId: handlerContext.instanceId,
        },
      })

      const broadcastEventWithRouting = {
        ...broadcastEvent,
        meta: {
          ...broadcastEvent.meta,
          destination: { instanceId: instance.instanceId },
        },
      }

      logger.info("DACP: Sending broadcast event to listener", {
        targetInstanceId: instance.instanceId,
        channelId,
        contextType: context.type,
        eventUuid: broadcastEvent.meta.eventUuid,
      })

      if (resolvedLogPayloadDetail === "full") {
        logger.debug("DACP: Sending broadcast event to listener (full payload)", {
          targetInstanceId: instance.instanceId,
          broadcastEventPayload: JSON.stringify(broadcastEvent.payload),
        })
      }

      handlerContext.responses.sendOutbound(broadcastEventWithRouting)

      const broadcastPayload = (broadcastEvent as BrowserTypes.BroadcastEvent).payload
      logger.debug("DACP: Broadcast event message structure", {
        type: broadcastEventWithRouting.type,
        hasPayload: !!broadcastPayload,
        hasContext: !!broadcastPayload?.context,
        contextType: broadcastPayload?.context?.type,
      })

      logger.debug("Broadcast event sent to listener", {
        instanceId: instance.instanceId,
        channelId,
        contextType: context.type,
      })
      successful++
    } catch (error) {
      failed++
      logger.error("Failed to notify context listener", {
        instanceId: instance.instanceId,
        error,
      })
    }
  })

  logger.info("DACP: Context listener notification complete", {
    channelId,
    contextType: context.type,
    successful,
    failed,
    total: successful + failed,
  })
}

function deliverCurrentContextToListener(
  instanceId: string,
  channelId: string,
  contextType: string,
  handlerContext: DACPHandlerContext
): void {
  const state = handlerContext.getState()
  const contextToDeliver =
    contextType === "*"
      ? getChannelContext(state, channelId)
      : getChannelContext(state, channelId, contextType)

  if (!contextToDeliver) {
    return
  }

  const storedContext = getStoredContext(state, channelId, contextToDeliver.type)
  const sourceInstanceId = storedContext?.sourceInstanceId
  const sourceInstance = sourceInstanceId ? getInstance(state, sourceInstanceId) : undefined

  const broadcastEvent = createDACPEvent("broadcastEvent", {
    channelId,
    context: contextToDeliver,
    originatingApp: {
      appId: sourceInstance?.appId ?? "unknown",
      instanceId: sourceInstanceId ?? "unknown",
    },
  })

  const broadcastEventWithRouting = {
    ...broadcastEvent,
    meta: {
      ...broadcastEvent.meta,
      destination: { instanceId },
    },
  }

  handlerContext.responses.sendOutbound(broadcastEventWithRouting)
}

function notifyPrivateChannelContextListeners(
  channelId: string,
  context: Context,
  handlerContext: DACPHandlerContext
): void {
  const { getState, logger } = handlerContext
  const privateChannel = getPrivateChannel(getState(), channelId)

  if (!privateChannel) {
    return
  }

  const contextListeners = Object.values(privateChannel.contextListeners)

  contextListeners
    .filter(listener => {
      if (listener.instanceId === handlerContext.instanceId) {
        return false
      }

      return listener.contextType === null || listener.contextType === context.type
    })
    .forEach(listener => {
      const senderInstance = getInstance(getState(), handlerContext.instanceId)
      const broadcastEvent = createDACPEvent("broadcastEvent", {
        channelId,
        context,
        originatingApp: {
          appId: senderInstance?.appId || "unknown",
          instanceId: handlerContext.instanceId,
        },
      })

      const broadcastEventWithRouting = {
        ...broadcastEvent,
        meta: {
          ...broadcastEvent.meta,
          destination: { instanceId: listener.instanceId },
        },
      }

      logger.info("DACP: Sending private channel broadcast event", {
        targetInstanceId: listener.instanceId,
        channelId,
        contextType: context.type,
      })

      handlerContext.responses.sendOutbound(broadcastEventWithRouting)
    })
}
