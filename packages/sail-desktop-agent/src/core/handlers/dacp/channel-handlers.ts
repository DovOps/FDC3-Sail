import { createDACPSuccessResponse, createDACPEvent } from "../../dacp/dacp-message-creators"
import { type DACPHandlerContext } from "../types"
import { sendDACPResponse, sendDACPErrorResponse } from "./utils/dacp-response-utils"
import { getEventListeners, ALL_DA_EVENT_TYPES } from "./event-handlers"
import {
  getInstance,
  getUserChannel,
  getAppChannel,
  getAllUserChannels,
  getChannelContext,
  getStoredContext,
  getPrivateChannel,
  getEventListener,
} from "../../state/selectors"
import { joinUserChannel, createAppChannel } from "../../state/mutators"
import type { BrowserTypes } from "@finos/fdc3"
import { ChannelError } from "@finos/fdc3"
import {
  ChannelAccessDeniedError,
  FDC3ChannelError,
  NoChannelFoundError,
} from "../../errors/fdc3-errors"

/**
 * Handles get current channel requests
 */
export function handleGetCurrentChannelRequest(
  message: BrowserTypes.GetCurrentChannelRequest,
  context: DACPHandlerContext
): void {
  const { responses, instanceId, getState, logger } = context

  try {
    const instance = getInstance(getState(), instanceId)
    const channelId = instance?.currentUserChannel ?? null

    // If no channel, return null
    if (!channelId) {
      const response = createDACPSuccessResponse(message, "getCurrentChannelResponse", {
        channel: null,
      })
      sendDACPResponse({ response, instanceId, responses })
      return
    }

    // Look up the channel object from state (user channel only — never app channels)
    const state = getState()
    const channel = getUserChannel(state, channelId)

    // If channel not found in state, create a minimal channel object
    // This shouldn't happen in normal operation, but provides a fallback
    if (!channel) {
      logger.warn("Channel not found in state, creating minimal channel object", {
        channelId,
        instanceId,
      })
      const fallback = {
        id: channelId,
        type: "user" as const,
      }
      const response = createDACPSuccessResponse(message, "getCurrentChannelResponse", {
        channel: fallback,
      })
      sendDACPResponse({ response, instanceId, responses })
      return
    }

    const response = createDACPSuccessResponse(message, "getCurrentChannelResponse", {
      channel,
    })
    sendDACPResponse({ response, instanceId, responses })
  } catch (error) {
    const errorType = error instanceof FDC3ChannelError ? error.errorType : ChannelError.ApiTimeout
    const errorMessage = error instanceof Error ? error.message : "Failed to get current channel"

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
 * Handles join user channel requests
 */
export function handleJoinUserChannelRequest(
  message: BrowserTypes.JoinUserChannelRequest,
  context: DACPHandlerContext
): void {
  const { responses, instanceId, getState, setState } = context

  try {
    const { channelId } = message.payload

    // Validate channel exists in user channels
    const state = getState()
    if (!getUserChannel(state, channelId)) {
      throw new NoChannelFoundError(`Channel ${channelId} does not exist`)
    }

    // Avoid duplicate current-context delivery on redundant joins (e.g. reconnect flows).
    const instance = getInstance(state, instanceId)
    const wasAlreadyOnChannel = instance?.currentUserChannel === channelId

    setState(state => joinUserChannel(state, instanceId, channelId))

    const response = {
      type: "joinUserChannelResponse",
      payload: {},
      meta: {
        responseUuid: message.meta.requestUuid,
        requestUuid: message.meta.requestUuid,
        timestamp: new Date().toISOString(),
      },
    } as unknown as BrowserTypes.AgentResponseMessage
    sendDACPResponse({ response, instanceId, responses })

    if (!wasAlreadyOnChannel) {
      deliverCurrentContextToInstanceListeners(instanceId, channelId, context)
      notifyChannelChanged(instanceId, channelId, context)
    }
  } catch (error) {
    const errorType = error instanceof FDC3ChannelError ? error.errorType : ChannelError.ApiTimeout
    const errorMessage = error instanceof Error ? error.message : "Failed to join user channel"

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
 * Handles leave current channel requests
 */
export function handleLeaveCurrentChannelRequest(
  message: BrowserTypes.LeaveCurrentChannelRequest,
  context: DACPHandlerContext
): void {
  const { responses, instanceId, setState } = context

  try {
    setState(state => joinUserChannel(state, instanceId, null))

    const response = createDACPSuccessResponse(message, "leaveCurrentChannelResponse")
    sendDACPResponse({ response, instanceId, responses })

    notifyChannelChanged(instanceId, null, context)
  } catch (error) {
    const errorType = error instanceof FDC3ChannelError ? error.errorType : ChannelError.ApiTimeout
    const errorMessage = error instanceof Error ? error.message : "Failed to leave current channel"

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
 * Handles get user channels requests
 */
export function handleGetUserChannelsRequest(
  message: BrowserTypes.GetUserChannelsRequest,
  context: DACPHandlerContext
): void {
  const { responses, instanceId, getState } = context

  try {
    const userChannels = getAllUserChannels(getState())

    const response = createDACPSuccessResponse(message, "getUserChannelsResponse", {
      userChannels,
    })
    sendDACPResponse({ response, instanceId, responses })
  } catch (error) {
    const errorType = error instanceof FDC3ChannelError ? error.errorType : ChannelError.ApiTimeout
    const errorMessage = error instanceof Error ? error.message : "Failed to get user channels"

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
 * Handles get current context requests
 */
export function handleGetCurrentContextRequest(
  message: BrowserTypes.GetCurrentContextRequest,
  context: DACPHandlerContext
): void {
  const { responses, instanceId, getState, logger } = context

  try {
    const payload = message.payload

    const instance = getInstance(getState(), instanceId)
    const channelId = payload.channelId ?? instance?.currentUserChannel

    if (!channelId) {
      throw new NoChannelFoundError("No channel specified and app is not on a channel")
    }

    // Get the last broadcast context for the channel
    const storedContext = getChannelContext(getState(), channelId, payload.contextType ?? undefined)

    logger.debug("DACP: getCurrentContext", {
      channelId,
      contextType: payload.contextType,
      hasContext: !!storedContext,
    })

    const response = createDACPSuccessResponse(message, "getCurrentContextResponse", {
      context: storedContext,
    })
    sendDACPResponse({ response, instanceId, responses })
  } catch (error) {
    const errorType = error instanceof FDC3ChannelError ? error.errorType : ChannelError.ApiTimeout
    const errorMessage = error instanceof Error ? error.message : "Failed to get current context"

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
 * Handles get or create channel requests
 * Returns an existing app channel or creates one with the given id.
 * Rejects ids that collide with a user channel or private channel.
 */
export function handleGetOrCreateChannelRequest(
  message: BrowserTypes.GetOrCreateChannelRequest,
  context: DACPHandlerContext
): void {
  const { responses, instanceId, getState, setState, logger } = context

  try {
    const { channelId } = message.payload

    // Get or create the app channel
    const state = getState()
    const userChannel = getUserChannel(state, channelId)
    const appChannel = getAppChannel(state, channelId)
    const privateChannel = getPrivateChannel(state, channelId)

    // App channel IDs must not overlap with user channels.
    if (userChannel) {
      throw new ChannelAccessDeniedError("AccessDenied")
    }

    // Private channels are created via intent-based workflows, not this API.
    if (privateChannel) {
      throw new ChannelAccessDeniedError("AccessDenied")
    }

    if (appChannel) {
      // Return existing app channel without creating a new one.
      const response = createDACPSuccessResponse(message, "getOrCreateChannelResponse", {
        channel: appChannel,
      })
      sendDACPResponse({ response, instanceId, responses })
      logger.debug("DACP: getOrCreateChannel", { channelId, existed: true })
      return
    }

    // Create a new app channel when none exists for this id.
    setState(state => createAppChannel(state, channelId))
    const newState = getState()
    const newAppChannel = getAppChannel(newState, channelId)
    const response = createDACPSuccessResponse(message, "getOrCreateChannelResponse", {
      channel: newAppChannel,
    })
    sendDACPResponse({ response, instanceId, responses })
    logger.debug("DACP: getOrCreateChannel", { channelId, existed: false })
  } catch (error) {
    const errorType =
      error instanceof FDC3ChannelError ? error.errorType : ChannelError.CreationFailed
    const errorMessage = error instanceof Error ? error.message : "Failed to get or create channel"

    sendDACPErrorResponse({
      message,
      errorType,
      errorMessage,
      instanceId,
      responses,
    })
  }
}

function deliverCurrentContextToInstanceListeners(
  instanceId: string,
  channelId: string,
  context: DACPHandlerContext
): void {
  const state = context.getState()
  const instance = getInstance(state, instanceId)
  if (!instance) {
    return
  }

  Object.entries(instance.contextListeners).forEach(([, spec]) => {
    if (spec.channelId !== undefined && spec.channelId !== channelId) {
      return
    }

    const listenerContextType = spec.contextType
    const contextToDeliver =
      listenerContextType === "*"
        ? getChannelContext(state, channelId)
        : getChannelContext(state, channelId, listenerContextType)

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

    context.responses.sendOutbound(broadcastEventWithRouting)
  })
}

function notifyChannelChanged(
  instanceId: string,
  channelId: string | null,
  context: DACPHandlerContext
): void {
  const { responses, logger, getState } = context
  const instance = getInstance(getState(), instanceId)
  if (!instance) {
    logger.warn("No instance found for channel change notification", { instanceId })
    return
  }

  const state = getState()
  const channelListeners = getEventListeners("channelChanged", context.getState)
  const allListeners = getEventListeners(ALL_DA_EVENT_TYPES, context.getState)
  const subscribers = [...new Set([...channelListeners, ...allListeners])]
  const subscriberInstanceIds = new Set(
    subscribers
      .map(listenerId => getEventListener(state, listenerId))
      .filter(
        (listener): listener is NonNullable<ReturnType<typeof getEventListener>> => !!listener
      )
      .map(listener => listener.instanceId)
  )

  const channelChangedEvent = createDACPEvent("channelChangedEvent", {
    channelId,
    newChannelId: channelId,
    identity: {
      appId: instance.appId,
      instanceId: instance.instanceId,
    },
  })

  subscriberInstanceIds.forEach(subscriberInstanceId => {
    const channelChangedEventWithRouting = {
      ...channelChangedEvent,
      meta: {
        ...channelChangedEvent.meta,
        destination: { instanceId: subscriberInstanceId },
      },
    }

    responses.sendOutbound(channelChangedEventWithRouting)
  })

  // When no app registered channelChanged listeners, still emit on the edge so
  // WCP connector can raise channelChanged for host chrome (same path as host-initiated joins).
  if (subscriberInstanceIds.size === 0) {
    responses.sendOutbound({
      ...channelChangedEvent,
      meta: {
        ...channelChangedEvent.meta,
        destination: { instanceId },
      },
    })
  }

  logger.debug("Channel changed event broadcast", {
    instanceId,
    channelId,
    subscribers: subscriberInstanceIds.size,
  })
}
