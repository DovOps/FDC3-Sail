// Auto-generated DACP schemas from @finos/fdc3-schema
// Generated on: 2025-11-10T16:49:55.327Z
// DO NOT EDIT MANUALLY - Run 'npm run generate:schemas' to regenerate

import { z } from "zod"

// Custom base schemas and helpers

// Base DACP message structure
export const BaseDACPMessageSchema = z.object({
  type: z.string(),
  payload: z.unknown().optional(),
  meta: z.object({
    requestUuid: z.string().optional(),
    responseUuid: z.string().optional(),
    eventUuid: z.string().optional(),
    timestamp: z.coerce.date(),
  }),
})

export type BaseDACPMessage = z.infer<typeof BaseDACPMessageSchema>

// Context schema - FDC3 contexts are extensible objects with a type field
// Using passthrough() to allow additional context-specific properties
export const ContextSchema = z
  .object({
    type: z.string(),
    id: z.record(z.string(), z.unknown()).optional(),
    name: z.string().optional(),
  })
  .passthrough()

export type Context = z.infer<typeof ContextSchema>

// AppIdentifier schema - properly typed from FDC3 spec
export const AppIdentifierSchema = z.object({
  appId: z.string(),
  instanceId: z.string().optional(),
  desktopAgent: z.string().optional(),
})

export type AppIdentifier = z.infer<typeof AppIdentifierSchema>

// Icon schema
export const IconSchema = z.object({
  src: z.string(),
  size: z.string().optional(),
  type: z.string().optional(),
})

// DisplayMetadata schema
export const DisplayMetadataSchema = z.object({
  name: z.string().optional(),
  color: z.string().optional(),
  glyph: z.string().optional(),
})

// WCP1Hello - Web Connection Protocol 1 Hello
export const WCP1HelloSchema = z.object({
  type: z.enum([
    "WCP1Hello",
    "WCP2LoadUrl",
    "WCP3Handshake",
    "WCP4ValidateAppIdentity",
    "WCP5ValidateAppIdentityFailedResponse",
    "WCP5ValidateAppIdentityResponse",
    "WCP6Goodbye",
  ]),
  payload: z.unknown().optional(),
  meta: z.object({ timestamp: z.coerce.date() }),
})

export type WCP1Hello = z.infer<typeof WCP1HelloSchema>

// WCP2LoadUrl - Web Connection Protocol 2 Load Url
export const WCP2LoadUrlSchema = z.object({
  type: z.enum([
    "WCP1Hello",
    "WCP2LoadUrl",
    "WCP3Handshake",
    "WCP4ValidateAppIdentity",
    "WCP5ValidateAppIdentityFailedResponse",
    "WCP5ValidateAppIdentityResponse",
    "WCP6Goodbye",
  ]),
  payload: z.unknown().optional(),
  meta: z.object({ timestamp: z.coerce.date() }),
})

export type WCP2LoadUrl = z.infer<typeof WCP2LoadUrlSchema>

// WCP3Handshake - Web Connection Protocol 3 Handshake
export const WCP3HandshakeSchema = z.object({
  type: z.enum([
    "WCP1Hello",
    "WCP2LoadUrl",
    "WCP3Handshake",
    "WCP4ValidateAppIdentity",
    "WCP5ValidateAppIdentityFailedResponse",
    "WCP5ValidateAppIdentityResponse",
    "WCP6Goodbye",
  ]),
  payload: z.unknown().optional(),
  meta: z.object({ timestamp: z.coerce.date() }),
})

export type WCP3Handshake = z.infer<typeof WCP3HandshakeSchema>

// WCP4ValidateAppIdentity - Web Connection Protocol 4 Validate App Identity
export const WCP4ValidateAppIdentitySchema = z.object({
  type: z.enum([
    "WCP1Hello",
    "WCP2LoadUrl",
    "WCP3Handshake",
    "WCP4ValidateAppIdentity",
    "WCP5ValidateAppIdentityFailedResponse",
    "WCP5ValidateAppIdentityResponse",
    "WCP6Goodbye",
  ]),
  payload: z.unknown().optional(),
  meta: z.object({ timestamp: z.coerce.date() }),
})

export type WCP4ValidateAppIdentity = z.infer<typeof WCP4ValidateAppIdentitySchema>

// WCP5ValidateAppIdentityFailedResponse - Web Connection Protocol 5 Validate App Identity Failed Response
export const WCP5ValidateAppIdentityFailedResponseSchema = z.object({
  type: z.enum([
    "WCP1Hello",
    "WCP2LoadUrl",
    "WCP3Handshake",
    "WCP4ValidateAppIdentity",
    "WCP5ValidateAppIdentityFailedResponse",
    "WCP5ValidateAppIdentityResponse",
    "WCP6Goodbye",
  ]),
  payload: z.unknown().optional(),
  meta: z.object({ responseUuid: z.string(), requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type WCP5ValidateAppIdentityFailedResponse = z.infer<
  typeof WCP5ValidateAppIdentityFailedResponseSchema
>

// WCP5ValidateAppIdentityResponse - Web Connection Protocol 5 Validate App Identity Success Response
export const WCP5ValidateAppIdentityResponseSchema = z.object({
  type: z.enum([
    "WCP1Hello",
    "WCP2LoadUrl",
    "WCP3Handshake",
    "WCP4ValidateAppIdentity",
    "WCP5ValidateAppIdentityFailedResponse",
    "WCP5ValidateAppIdentityResponse",
    "WCP6Goodbye",
  ]),
  payload: z.unknown().optional(),
  meta: z.object({ responseUuid: z.string(), requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type WCP5ValidateAppIdentityResponse = z.infer<typeof WCP5ValidateAppIdentityResponseSchema>

// WCP6Goodbye - Web Connection Protocol 6 Goodbye
export const WCP6GoodbyeSchema = z.object({
  type: z.enum([
    "WCP1Hello",
    "WCP2LoadUrl",
    "WCP3Handshake",
    "WCP4ValidateAppIdentity",
    "WCP5ValidateAppIdentityFailedResponse",
    "WCP5ValidateAppIdentityResponse",
    "WCP6Goodbye",
  ]),
  payload: z.unknown().optional(),
  meta: z.object({ timestamp: z.coerce.date() }),
})

export type WCP6Goodbye = z.infer<typeof WCP6GoodbyeSchema>

// WCPConnectionStep - Web Connection Protocol Message
export const WCPConnectionStepSchema = z.object({
  type: z.enum([
    "WCP1Hello",
    "WCP2LoadUrl",
    "WCP3Handshake",
    "WCP4ValidateAppIdentity",
    "WCP5ValidateAppIdentityFailedResponse",
    "WCP5ValidateAppIdentityResponse",
    "WCP6Goodbye",
  ]),
  payload: z.record(z.string(), z.unknown()).optional(),
  meta: z.union([
    z.object({ timestamp: z.coerce.date() }),
    z.object({ connectionAttemptUuid: z.string(), timestamp: z.coerce.date() }),
  ]),
})

export type WCPConnectionStep = z.infer<typeof WCPConnectionStepSchema>

// AddContextListenerRequest - AddContextListener Request
export const AddContextListenerRequestSchema = z.object({
  type: z.literal("addContextListenerRequest"),
  payload: z.object({
    channelId: z.union([z.string(), z.null()]).optional(),
    contextType: z.union([z.string(), z.null()]).optional(),
  }),
  meta: z.object({ requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type AddContextListenerRequest = z.infer<typeof AddContextListenerRequestSchema>

// AddContextListenerResponse - AddContextListener Response
export const AddContextListenerResponseSchema = z.object({
  type: z.literal("addContextListenerResponse"),
  payload: z.union([
    z.object({ listenerUUID: z.string() }),
    z.object({
      error: z.enum([
        "AccessDenied",
        "CreationFailed",
        "MalformedContext",
        "NoChannelFound",
        "ApiTimeout",
        "InvalidArguments",
      ]),
    }),
  ]),
  meta: z.object({ responseUuid: z.string(), requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type AddContextListenerResponse = z.infer<typeof AddContextListenerResponseSchema>

// AddEventListenerRequest - AddEventListener Request
export const AddEventListenerRequestSchema = z.object({
  type: z.literal("addEventListenerRequest"),
  payload: z.object({ type: z.union([z.literal("USER_CHANNEL_CHANGED"), z.null()]) }),
  meta: z.object({ requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type AddEventListenerRequest = z.infer<typeof AddEventListenerRequestSchema>

// AddEventListenerResponse - AddEventListener Response
export const AddEventListenerResponseSchema = z.object({
  type: z.literal("addEventListenerResponse"),
  payload: z.union([
    z.object({ listenerUUID: z.string() }),
    z.object({
      error: z.union([
        z.enum([
          "AccessDenied",
          "CreationFailed",
          "MalformedContext",
          "NoChannelFound",
          "ApiTimeout",
          "InvalidArguments",
        ]),
        z.enum([
          "AppNotFound",
          "AppTimeout",
          "DesktopAgentNotFound",
          "ErrorOnLaunch",
          "MalformedContext",
          "ResolverUnavailable",
          "ApiTimeout",
          "InvalidArguments",
        ]),
        z.enum([
          "DesktopAgentNotFound",
          "IntentDeliveryFailed",
          "MalformedContext",
          "NoAppsFound",
          "ResolverTimeout",
          "ResolverUnavailable",
          "TargetAppUnavailable",
          "TargetInstanceUnavailable",
          "UserCancelledResolution",
          "ApiTimeout",
          "InvalidArguments",
        ]),
        z.enum(["IntentHandlerRejected", "NoResultReturned", "ApiTimeout"]),
        z.enum([
          "AgentDisconnected",
          "NotConnectedToBridge",
          "ResponseToBridgeTimedOut",
          "MalformedMessage",
        ]),
      ]),
    }),
  ]),
  meta: z.object({ responseUuid: z.string(), requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type AddEventListenerResponse = z.infer<typeof AddEventListenerResponseSchema>

// AddIntentListenerRequest - AddIntentListener Request
export const AddIntentListenerRequestSchema = z.object({
  type: z.literal("addIntentListenerRequest"),
  payload: z.object({ intent: z.string() }),
  meta: z.object({ requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type AddIntentListenerRequest = z.infer<typeof AddIntentListenerRequestSchema>

// AddIntentListenerResponse - AddIntentListener Response
export const AddIntentListenerResponseSchema = z.object({
  type: z.literal("addIntentListenerResponse"),
  payload: z.union([
    z.object({ listenerUUID: z.string() }),
    z.object({
      error: z.enum([
        "DesktopAgentNotFound",
        "IntentDeliveryFailed",
        "MalformedContext",
        "NoAppsFound",
        "ResolverTimeout",
        "ResolverUnavailable",
        "TargetAppUnavailable",
        "TargetInstanceUnavailable",
        "UserCancelledResolution",
        "ApiTimeout",
        "InvalidArguments",
      ]),
    }),
  ]),
  meta: z.object({ responseUuid: z.string(), requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type AddIntentListenerResponse = z.infer<typeof AddIntentListenerResponseSchema>

// BroadcastEvent - broadcast Event
export const BroadcastEventSchema = z.object({
  type: z.literal("broadcastEvent"),
  payload: z.object({
    channelId: z.union([z.string(), z.null()]),
    context: ContextSchema,
    originatingApp: z.object({
      appId: z.string(),
      instanceId: z.string().optional(),
      desktopAgent: z.string().optional(),
    }),
  }),
  meta: z.object({ eventUuid: z.string(), timestamp: z.coerce.date() }),
})

export type BroadcastEvent = z.infer<typeof BroadcastEventSchema>

// BroadcastRequest - Broadcast Request
export const BroadcastRequestSchema = z.object({
  type: z.literal("broadcastRequest"),
  payload: z.object({ channelId: z.string(), context: ContextSchema }),
  meta: z.object({ requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type BroadcastRequest = z.infer<typeof BroadcastRequestSchema>

// BroadcastResponse - Broadcast Response
export const BroadcastResponseSchema = z.object({
  type: z.literal("broadcastResponse"),
  payload: z.unknown().optional(),
  meta: z.object({ responseUuid: z.string(), requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type BroadcastResponse = z.infer<typeof BroadcastResponseSchema>

// ChannelChangedEvent - channelChanged Event
export const ChannelChangedEventSchema = z.object({
  type: z.literal("channelChangedEvent"),
  payload: z.object({ newChannelId: z.union([z.string(), z.null()]) }),
  meta: z.object({ eventUuid: z.string(), timestamp: z.coerce.date() }),
})

export type ChannelChangedEvent = z.infer<typeof ChannelChangedEventSchema>

// ContextListenerUnsubscribeRequest - ContextListenerUnsubscribe Request
export const ContextListenerUnsubscribeRequestSchema = z.object({
  type: z.literal("contextListenerUnsubscribeRequest"),
  payload: z.object({ listenerUUID: z.string() }),
  meta: z.object({ requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type ContextListenerUnsubscribeRequest = z.infer<
  typeof ContextListenerUnsubscribeRequestSchema
>

// ContextListenerUnsubscribeResponse - ContextListenerUnsubscribe Response
export const ContextListenerUnsubscribeResponseSchema = z.object({
  type: z.literal("contextListenerUnsubscribeResponse"),
  payload: z.unknown().optional(),
  meta: z.object({ responseUuid: z.string(), requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type ContextListenerUnsubscribeResponse = z.infer<
  typeof ContextListenerUnsubscribeResponseSchema
>

// CreatePrivateChannelRequest - CreatePrivateChannel Request
export const CreatePrivateChannelRequestSchema = z.object({
  type: z.literal("createPrivateChannelRequest"),
  payload: z.object({}),
  meta: z.object({ requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type CreatePrivateChannelRequest = z.infer<typeof CreatePrivateChannelRequestSchema>

// CreatePrivateChannelResponse - CreatePrivateChannel Response
export const CreatePrivateChannelResponseSchema = z.object({
  type: z.literal("createPrivateChannelResponse"),
  payload: z.union([
    z.object({ privateChannel: ContextSchema }),
    z.object({
      error: z.enum([
        "AccessDenied",
        "CreationFailed",
        "MalformedContext",
        "NoChannelFound",
        "ApiTimeout",
        "InvalidArguments",
      ]),
    }),
  ]),
  meta: z.object({ responseUuid: z.string(), requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type CreatePrivateChannelResponse = z.infer<typeof CreatePrivateChannelResponseSchema>

// EventListenerUnsubscribeRequest - EventListenerUnsubscribe Request
export const EventListenerUnsubscribeRequestSchema = z.object({
  type: z.literal("eventListenerUnsubscribeRequest"),
  payload: z.object({ listenerUUID: z.string() }),
  meta: z.object({ requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type EventListenerUnsubscribeRequest = z.infer<typeof EventListenerUnsubscribeRequestSchema>

// EventListenerUnsubscribeResponse - EventListenerUnsubscribe Response
export const EventListenerUnsubscribeResponseSchema = z.object({
  type: z.literal("eventListenerUnsubscribeResponse"),
  payload: z.unknown().optional(),
  meta: z.object({ responseUuid: z.string(), requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type EventListenerUnsubscribeResponse = z.infer<
  typeof EventListenerUnsubscribeResponseSchema
>

// Fdc3UserInterfaceChannelSelected - Fdc3 UserInterface Channel Selected
export const Fdc3UserInterfaceChannelSelectedSchema = z.object({
  type: z.enum([
    "Fdc3UserInterfaceHello",
    "Fdc3UserInterfaceHandshake",
    "Fdc3UserInterfaceRestyle",
    "Fdc3UserInterfaceDrag",
    "Fdc3UserInterfaceResolve",
    "Fdc3UserInterfaceResolveAction",
    "Fdc3UserInterfaceChannels",
    "Fdc3UserInterfaceChannelSelected",
  ]),
  payload: z.unknown().optional(),
  meta: z.object({ timestamp: z.coerce.date() }),
})

export type Fdc3UserInterfaceChannelSelected = z.infer<
  typeof Fdc3UserInterfaceChannelSelectedSchema
>

// Fdc3UserInterfaceChannels - Fdc3 UserInterface Channels
export const Fdc3UserInterfaceChannelsSchema = z.object({
  type: z.enum([
    "Fdc3UserInterfaceHello",
    "Fdc3UserInterfaceHandshake",
    "Fdc3UserInterfaceRestyle",
    "Fdc3UserInterfaceDrag",
    "Fdc3UserInterfaceResolve",
    "Fdc3UserInterfaceResolveAction",
    "Fdc3UserInterfaceChannels",
    "Fdc3UserInterfaceChannelSelected",
  ]),
  payload: z.unknown().optional(),
  meta: z.object({ timestamp: z.coerce.date() }),
})

export type Fdc3UserInterfaceChannels = z.infer<typeof Fdc3UserInterfaceChannelsSchema>

// Fdc3UserInterfaceDrag - Fdc3 UserInterface Drag
export const Fdc3UserInterfaceDragSchema = z.object({
  type: z.enum([
    "Fdc3UserInterfaceHello",
    "Fdc3UserInterfaceHandshake",
    "Fdc3UserInterfaceRestyle",
    "Fdc3UserInterfaceDrag",
    "Fdc3UserInterfaceResolve",
    "Fdc3UserInterfaceResolveAction",
    "Fdc3UserInterfaceChannels",
    "Fdc3UserInterfaceChannelSelected",
  ]),
  payload: z.unknown().optional(),
  meta: z.object({ timestamp: z.coerce.date() }),
})

export type Fdc3UserInterfaceDrag = z.infer<typeof Fdc3UserInterfaceDragSchema>

// Fdc3UserInterfaceHandshake - Fdc3 UserInterface Handshake
export const Fdc3UserInterfaceHandshakeSchema = z.object({
  type: z.enum([
    "Fdc3UserInterfaceHello",
    "Fdc3UserInterfaceHandshake",
    "Fdc3UserInterfaceRestyle",
    "Fdc3UserInterfaceDrag",
    "Fdc3UserInterfaceResolve",
    "Fdc3UserInterfaceResolveAction",
    "Fdc3UserInterfaceChannels",
    "Fdc3UserInterfaceChannelSelected",
  ]),
  payload: z.unknown().optional(),
  meta: z.object({ timestamp: z.coerce.date() }),
})

export type Fdc3UserInterfaceHandshake = z.infer<typeof Fdc3UserInterfaceHandshakeSchema>

// Fdc3UserInterfaceHello - Fdc3 UserInterface Hello
export const Fdc3UserInterfaceHelloSchema = z.object({
  type: z.enum([
    "Fdc3UserInterfaceHello",
    "Fdc3UserInterfaceHandshake",
    "Fdc3UserInterfaceRestyle",
    "Fdc3UserInterfaceDrag",
    "Fdc3UserInterfaceResolve",
    "Fdc3UserInterfaceResolveAction",
    "Fdc3UserInterfaceChannels",
    "Fdc3UserInterfaceChannelSelected",
  ]),
  payload: z.unknown().optional(),
  meta: z.object({ timestamp: z.coerce.date() }),
})

export type Fdc3UserInterfaceHello = z.infer<typeof Fdc3UserInterfaceHelloSchema>

// Fdc3UserInterfaceMessage - Fdc3 UserInterface Message
export const Fdc3UserInterfaceMessageSchema = z.object({
  type: z.enum([
    "Fdc3UserInterfaceHello",
    "Fdc3UserInterfaceHandshake",
    "Fdc3UserInterfaceRestyle",
    "Fdc3UserInterfaceDrag",
    "Fdc3UserInterfaceResolve",
    "Fdc3UserInterfaceResolveAction",
    "Fdc3UserInterfaceChannels",
    "Fdc3UserInterfaceChannelSelected",
  ]),
  payload: z.record(z.string(), z.unknown()).optional(),
})

export type Fdc3UserInterfaceMessage = z.infer<typeof Fdc3UserInterfaceMessageSchema>

// Fdc3UserInterfaceResolve - Fdc3 UserInterface Resolve
export const Fdc3UserInterfaceResolveSchema = z.object({
  type: z.enum([
    "Fdc3UserInterfaceHello",
    "Fdc3UserInterfaceHandshake",
    "Fdc3UserInterfaceRestyle",
    "Fdc3UserInterfaceDrag",
    "Fdc3UserInterfaceResolve",
    "Fdc3UserInterfaceResolveAction",
    "Fdc3UserInterfaceChannels",
    "Fdc3UserInterfaceChannelSelected",
  ]),
  payload: z.unknown().optional(),
  meta: z.object({ timestamp: z.coerce.date() }),
})

export type Fdc3UserInterfaceResolve = z.infer<typeof Fdc3UserInterfaceResolveSchema>

// Fdc3UserInterfaceResolveAction - Fdc3 UserInterface Resolve Action
export const Fdc3UserInterfaceResolveActionSchema = z.object({
  type: z.enum([
    "Fdc3UserInterfaceHello",
    "Fdc3UserInterfaceHandshake",
    "Fdc3UserInterfaceRestyle",
    "Fdc3UserInterfaceDrag",
    "Fdc3UserInterfaceResolve",
    "Fdc3UserInterfaceResolveAction",
    "Fdc3UserInterfaceChannels",
    "Fdc3UserInterfaceChannelSelected",
  ]),
  payload: z.unknown().optional(),
  meta: z.object({ timestamp: z.coerce.date() }),
})

export type Fdc3UserInterfaceResolveAction = z.infer<typeof Fdc3UserInterfaceResolveActionSchema>

// Fdc3UserInterfaceRestyle - Fdc3 UserInterface Restyle
export const Fdc3UserInterfaceRestyleSchema = z.object({
  type: z.enum([
    "Fdc3UserInterfaceHello",
    "Fdc3UserInterfaceHandshake",
    "Fdc3UserInterfaceRestyle",
    "Fdc3UserInterfaceDrag",
    "Fdc3UserInterfaceResolve",
    "Fdc3UserInterfaceResolveAction",
    "Fdc3UserInterfaceChannels",
    "Fdc3UserInterfaceChannelSelected",
  ]),
  payload: z.unknown().optional(),
  meta: z.object({ timestamp: z.coerce.date() }),
})

export type Fdc3UserInterfaceRestyle = z.infer<typeof Fdc3UserInterfaceRestyleSchema>

// FindInstancesRequest - FindInstances Request
export const FindInstancesRequestSchema = z.object({
  type: z.literal("findInstancesRequest"),
  payload: z.object({
    app: z.object({
      appId: z.string(),
      instanceId: z.string().optional(),
      desktopAgent: z.string().optional(),
    }),
  }),
  meta: z.object({ requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type FindInstancesRequest = z.infer<typeof FindInstancesRequestSchema>

// FindInstancesResponse - FindInstances Response
export const FindInstancesResponseSchema = z.object({
  type: z.literal("findInstancesResponse"),
  payload: z.union([
    z.object({
      appIdentifiers: z.array(
        z.object({
          name: z.string().optional(),
          version: z.string().optional(),
          instanceMetadata: z.record(z.string(), z.unknown()).optional(),
          title: z.string().optional(),
          tooltip: z.string().optional(),
          description: z.string().optional(),
          icons: z.array(
            z.object({ src: z.string(), size: z.string().optional(), type: z.string().optional() })
          ),
          screenshots: z.array(
            z.object({
              src: z.string(),
              size: z.string().optional(),
              type: z.string().optional(),
              label: z.string().optional(),
            })
          ),
          resultType: z.unknown().optional(),
          appId: z.string(),
          instanceId: z.string().optional(),
          desktopAgent: z.string().optional(),
        })
      ),
    }),
    z.object({ error: z.string() }),
  ]),
  meta: z.object({ responseUuid: z.string(), requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type FindInstancesResponse = z.infer<typeof FindInstancesResponseSchema>

// FindIntentRequest - FindIntent Request
export const FindIntentRequestSchema = z.object({
  type: z.literal("findIntentRequest"),
  payload: z.object({
    intent: z.string(),
    context: ContextSchema.optional(),
    resultType: z.string().optional(),
  }),
  meta: z.object({ requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type FindIntentRequest = z.infer<typeof FindIntentRequestSchema>

// FindIntentResponse - FindIntent Response
export const FindIntentResponseSchema = z.object({
  type: z.literal("findIntentResponse"),
  payload: z.union([
    z.object({
      appIntent: z.object({
        intent: z.object({ name: z.string(), displayName: z.string().optional() }),
        apps: z.array(
          z.object({
            name: z.string().optional(),
            version: z.string().optional(),
            instanceMetadata: z.record(z.string(), z.unknown()).optional(),
            title: z.string().optional(),
            tooltip: z.string().optional(),
            description: z.string().optional(),
            icons: z.array(z.unknown()).optional(),
            screenshots: z.array(z.unknown()).optional(),
            resultType: z.unknown().optional(),
            appId: z.string(),
            instanceId: z.string().optional(),
            desktopAgent: z.string().optional(),
          })
        ),
      }),
    }),
    z.object({
      error: z.union([
        z.enum([
          "DesktopAgentNotFound",
          "IntentDeliveryFailed",
          "MalformedContext",
          "NoAppsFound",
          "ResolverTimeout",
          "ResolverUnavailable",
          "TargetAppUnavailable",
          "TargetInstanceUnavailable",
          "UserCancelledResolution",
          "ApiTimeout",
          "InvalidArguments",
        ]),
        z.enum([
          "AgentDisconnected",
          "NotConnectedToBridge",
          "ResponseToBridgeTimedOut",
          "MalformedMessage",
        ]),
      ]),
    }),
  ]),
  meta: z.object({ responseUuid: z.string(), requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type FindIntentResponse = z.infer<typeof FindIntentResponseSchema>

// FindIntentsByContextRequest - FindIntentsByContext Request
export const FindIntentsByContextRequestSchema = z.object({
  type: z.literal("findIntentsByContextRequest"),
  payload: z.object({ context: ContextSchema, resultType: z.string().optional() }),
  meta: z.object({ requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type FindIntentsByContextRequest = z.infer<typeof FindIntentsByContextRequestSchema>

// FindIntentsByContextResponse - FindIntentsByContext Response
export const FindIntentsByContextResponseSchema = z.object({
  type: z.literal("findIntentsByContextResponse"),
  payload: z.union([
    z.object({
      appIntents: z.array(
        z.object({
          intent: z.object({ name: z.string(), displayName: z.string().optional() }),
          apps: z.array(
            z.object({
              name: z.string().optional(),
              version: z.string().optional(),
              instanceMetadata: z.record(z.string(), z.unknown()).optional(),
              title: z.string().optional(),
              tooltip: z.string().optional(),
              description: z.string().optional(),
              icons: z.array(z.unknown()).optional(),
              screenshots: z.array(z.unknown()).optional(),
              resultType: z.unknown().optional(),
              appId: z.string(),
              instanceId: z.string().optional(),
              desktopAgent: z.string().optional(),
            })
          ),
        })
      ),
    }),
    z.object({
      error: z.union([
        z.enum([
          "DesktopAgentNotFound",
          "IntentDeliveryFailed",
          "MalformedContext",
          "NoAppsFound",
          "ResolverTimeout",
          "ResolverUnavailable",
          "TargetAppUnavailable",
          "TargetInstanceUnavailable",
          "UserCancelledResolution",
          "ApiTimeout",
          "InvalidArguments",
        ]),
        z.enum([
          "AgentDisconnected",
          "NotConnectedToBridge",
          "ResponseToBridgeTimedOut",
          "MalformedMessage",
        ]),
      ]),
    }),
  ]),
  meta: z.object({ responseUuid: z.string(), requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type FindIntentsByContextResponse = z.infer<typeof FindIntentsByContextResponseSchema>

// GetAppMetadataRequest - GetAppMetadata Request
export const GetAppMetadataRequestSchema = z.object({
  type: z.literal("getAppMetadataRequest"),
  payload: z.object({
    app: z.object({
      appId: z.string(),
      instanceId: z.string().optional(),
      desktopAgent: z.string().optional(),
    }),
  }),
  meta: z.object({ requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type GetAppMetadataRequest = z.infer<typeof GetAppMetadataRequestSchema>

// GetAppMetadataResponse - GetAppMetadata Response
export const GetAppMetadataResponseSchema = z.object({
  type: z.literal("getAppMetadataResponse"),
  payload: z.union([
    z.object({
      appMetadata: z.object({
        name: z.string().optional(),
        version: z.string().optional(),
        instanceMetadata: z.record(z.string(), z.unknown()).optional(),
        title: z.string().optional(),
        tooltip: z.string().optional(),
        description: z.string().optional(),
        icons: z.array(
          z.object({ src: z.string(), size: z.string().optional(), type: z.string().optional() })
        ),
        screenshots: z.array(
          z.object({
            src: z.string(),
            size: z.string().optional(),
            type: z.string().optional(),
            label: z.string().optional(),
          })
        ),
        resultType: z.unknown().optional(),
        appId: z.string(),
        instanceId: z.string().optional(),
        desktopAgent: z.string().optional(),
      }),
    }),
    z.object({
      error: z.union([
        z.enum([
          "DesktopAgentNotFound",
          "IntentDeliveryFailed",
          "MalformedContext",
          "NoAppsFound",
          "ResolverTimeout",
          "ResolverUnavailable",
          "TargetAppUnavailable",
          "TargetInstanceUnavailable",
          "UserCancelledResolution",
          "ApiTimeout",
          "InvalidArguments",
        ]),
        z.enum([
          "AgentDisconnected",
          "NotConnectedToBridge",
          "ResponseToBridgeTimedOut",
          "MalformedMessage",
        ]),
      ]),
    }),
  ]),
  meta: z.object({ responseUuid: z.string(), requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type GetAppMetadataResponse = z.infer<typeof GetAppMetadataResponseSchema>

// GetCurrentChannelRequest - GetCurrentChannel Request
export const GetCurrentChannelRequestSchema = z.object({
  type: z.literal("getCurrentChannelRequest"),
  payload: z.object({}),
  meta: z.object({ requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type GetCurrentChannelRequest = z.infer<typeof GetCurrentChannelRequestSchema>

// GetCurrentChannelResponse - GetCurrentChannel Response
export const GetCurrentChannelResponseSchema = z.object({
  type: z.literal("getCurrentChannelResponse"),
  payload: z.union([
    z.object({ channel: z.union([ContextSchema, z.null()]) }),
    z.object({
      error: z.union([
        z.enum([
          "AccessDenied",
          "CreationFailed",
          "MalformedContext",
          "NoChannelFound",
          "ApiTimeout",
          "InvalidArguments",
        ]),
        z.enum([
          "AppNotFound",
          "AppTimeout",
          "DesktopAgentNotFound",
          "ErrorOnLaunch",
          "MalformedContext",
          "ResolverUnavailable",
          "ApiTimeout",
          "InvalidArguments",
        ]),
        z.enum([
          "DesktopAgentNotFound",
          "IntentDeliveryFailed",
          "MalformedContext",
          "NoAppsFound",
          "ResolverTimeout",
          "ResolverUnavailable",
          "TargetAppUnavailable",
          "TargetInstanceUnavailable",
          "UserCancelledResolution",
          "ApiTimeout",
          "InvalidArguments",
        ]),
        z.enum(["IntentHandlerRejected", "NoResultReturned", "ApiTimeout"]),
        z.enum([
          "AgentDisconnected",
          "NotConnectedToBridge",
          "ResponseToBridgeTimedOut",
          "MalformedMessage",
        ]),
      ]),
    }),
  ]),
  meta: z.object({ responseUuid: z.string(), requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type GetCurrentChannelResponse = z.infer<typeof GetCurrentChannelResponseSchema>

// GetCurrentContextRequest - GetCurrentContext Request
export const GetCurrentContextRequestSchema = z.object({
  type: z.literal("getCurrentContextRequest"),
  payload: z.object({ channelId: z.string(), contextType: z.union([z.string(), z.null()]) }),
  meta: z.object({ requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type GetCurrentContextRequest = z.infer<typeof GetCurrentContextRequestSchema>

// GetCurrentContextResponse - GetCurrentContext Response
export const GetCurrentContextResponseSchema = z.object({
  type: z.literal("getCurrentContextResponse"),
  payload: z.union([
    z.object({ context: z.union([ContextSchema, z.null()]) }),
    z.object({
      error: z.enum([
        "AccessDenied",
        "CreationFailed",
        "MalformedContext",
        "NoChannelFound",
        "ApiTimeout",
        "InvalidArguments",
      ]),
    }),
  ]),
  meta: z.object({ responseUuid: z.string(), requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type GetCurrentContextResponse = z.infer<typeof GetCurrentContextResponseSchema>

// GetInfoRequest - GetInfo Request
export const GetInfoRequestSchema = z.object({
  type: z.literal("getInfoRequest"),
  payload: z.object({}),
  meta: z.object({ requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type GetInfoRequest = z.infer<typeof GetInfoRequestSchema>

// GetInfoResponse - GetInfo Response
export const GetInfoResponseSchema = z.object({
  type: z.literal("getInfoResponse"),
  payload: z.union([
    z.object({
      implementationMetadata: z.object({
        fdc3Version: z.unknown().optional(),
        provider: z.unknown().optional(),
        providerVersion: z.unknown().optional(),
        optionalFeatures: z.unknown().optional(),
        appMetadata: z.unknown().optional(),
      }),
    }),
    z.object({
      error: z.union([
        z.enum([
          "AccessDenied",
          "CreationFailed",
          "MalformedContext",
          "NoChannelFound",
          "ApiTimeout",
          "InvalidArguments",
        ]),
        z.enum([
          "AppNotFound",
          "AppTimeout",
          "DesktopAgentNotFound",
          "ErrorOnLaunch",
          "MalformedContext",
          "ResolverUnavailable",
          "ApiTimeout",
          "InvalidArguments",
        ]),
        z.enum([
          "DesktopAgentNotFound",
          "IntentDeliveryFailed",
          "MalformedContext",
          "NoAppsFound",
          "ResolverTimeout",
          "ResolverUnavailable",
          "TargetAppUnavailable",
          "TargetInstanceUnavailable",
          "UserCancelledResolution",
          "ApiTimeout",
          "InvalidArguments",
        ]),
        z.enum(["IntentHandlerRejected", "NoResultReturned", "ApiTimeout"]),
        z.enum([
          "AgentDisconnected",
          "NotConnectedToBridge",
          "ResponseToBridgeTimedOut",
          "MalformedMessage",
        ]),
      ]),
    }),
  ]),
  meta: z.object({ responseUuid: z.string(), requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type GetInfoResponse = z.infer<typeof GetInfoResponseSchema>

// GetOrCreateChannelRequest - GetOrCreateChannel Request
export const GetOrCreateChannelRequestSchema = z.object({
  type: z.literal("getOrCreateChannelRequest"),
  payload: z.object({ channelId: z.string() }),
  meta: z.object({ requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type GetOrCreateChannelRequest = z.infer<typeof GetOrCreateChannelRequestSchema>

// GetOrCreateChannelResponse - GetOrCreateChannel Response
export const GetOrCreateChannelResponseSchema = z.object({
  type: z.literal("getOrCreateChannelResponse"),
  payload: z.union([
    z.object({ channel: ContextSchema }),
    z.object({
      error: z.enum([
        "AccessDenied",
        "CreationFailed",
        "MalformedContext",
        "NoChannelFound",
        "ApiTimeout",
        "InvalidArguments",
      ]),
    }),
  ]),
  meta: z.object({ responseUuid: z.string(), requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type GetOrCreateChannelResponse = z.infer<typeof GetOrCreateChannelResponseSchema>

// GetUserChannelsRequest - GetUserChannels Request
export const GetUserChannelsRequestSchema = z.object({
  type: z.literal("getUserChannelsRequest"),
  payload: z.object({}),
  meta: z.object({ requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type GetUserChannelsRequest = z.infer<typeof GetUserChannelsRequestSchema>

// GetUserChannelsResponse - GetUserChannels Response
export const GetUserChannelsResponseSchema = z.object({
  type: z.literal("getUserChannelsResponse"),
  payload: z.union([
    z.object({ userChannels: z.array(ContextSchema) }),
    z.object({
      error: z.enum([
        "AccessDenied",
        "CreationFailed",
        "MalformedContext",
        "NoChannelFound",
        "ApiTimeout",
        "InvalidArguments",
      ]),
    }),
  ]),
  meta: z.object({ responseUuid: z.string(), requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type GetUserChannelsResponse = z.infer<typeof GetUserChannelsResponseSchema>

// HeartbeatAcknowledgmentRequest - HeartbeatAcknowledgement Request
export const HeartbeatAcknowledgmentRequestSchema = z.object({
  type: z.literal("heartbeatAcknowledgementRequest"),
  payload: z.object({ heartbeatEventUuid: z.string() }),
  meta: z.object({ requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type HeartbeatAcknowledgmentRequest = z.infer<typeof HeartbeatAcknowledgmentRequestSchema>

// HeartbeatEvent - Heartbeat Event
export const HeartbeatEventSchema = z.object({
  type: z.literal("heartbeatEvent"),
  payload: z.object({}),
  meta: z.object({ eventUuid: z.string(), timestamp: z.coerce.date() }),
})

export type HeartbeatEvent = z.infer<typeof HeartbeatEventSchema>

// IntentEvent - intent Event
export const IntentEventSchema = z.object({
  type: z.literal("intentEvent"),
  payload: z.object({
    intent: z.string(),
    context: ContextSchema,
    originatingApp: z.object({
      appId: z.string(),
      instanceId: z.string().optional(),
      desktopAgent: z.string().optional(),
    }),
    raiseIntentRequestUuid: z.string(),
  }),
  meta: z.object({ eventUuid: z.string(), timestamp: z.coerce.date() }),
})

export type IntentEvent = z.infer<typeof IntentEventSchema>

// IntentListenerUnsubscribeRequest - IntentListenerUnsubscribe Request
export const IntentListenerUnsubscribeRequestSchema = z.object({
  type: z.literal("intentListenerUnsubscribeRequest"),
  payload: z.object({ listenerUUID: z.string() }),
  meta: z.object({ requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type IntentListenerUnsubscribeRequest = z.infer<
  typeof IntentListenerUnsubscribeRequestSchema
>

// IntentListenerUnsubscribeResponse - IntentListenerUnsubscribe Response
export const IntentListenerUnsubscribeResponseSchema = z.object({
  type: z.literal("intentListenerUnsubscribeResponse"),
  payload: z.unknown().optional(),
  meta: z.object({ responseUuid: z.string(), requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type IntentListenerUnsubscribeResponse = z.infer<
  typeof IntentListenerUnsubscribeResponseSchema
>

// IntentResultRequest - IntentResult Request
export const IntentResultRequestSchema = z.object({
  type: z.literal("intentResultRequest"),
  payload: z.object({
    intentEventUuid: z.string(),
    raiseIntentRequestUuid: z.string(),
    intentResult: z.unknown(),
  }),
  meta: z.object({ requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type IntentResultRequest = z.infer<typeof IntentResultRequestSchema>

// IntentResultResponse - IntentResult Response
export const IntentResultResponseSchema = z.object({
  type: z.literal("intentResultResponse"),
  payload: z.unknown().optional(),
  meta: z.object({ responseUuid: z.string(), requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type IntentResultResponse = z.infer<typeof IntentResultResponseSchema>

// JoinUserChannelRequest - JoinUserChannel Request
export const JoinUserChannelRequestSchema = z.object({
  type: z.literal("joinUserChannelRequest"),
  payload: z.object({ channelId: z.string() }),
  meta: z.object({ requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type JoinUserChannelRequest = z.infer<typeof JoinUserChannelRequestSchema>

// JoinUserChannelResponse - JoinUserChannel Response
export const JoinUserChannelResponseSchema = z.object({
  type: z.literal("joinUserChannelResponse"),
  payload: z.union([
    z.object({}),
    z.object({
      error: z.enum([
        "AccessDenied",
        "CreationFailed",
        "MalformedContext",
        "NoChannelFound",
        "ApiTimeout",
        "InvalidArguments",
      ]),
    }),
  ]),
  meta: z.object({ responseUuid: z.string(), requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type JoinUserChannelResponse = z.infer<typeof JoinUserChannelResponseSchema>

// LeaveCurrentChannelRequest - LeaveCurrentChannel Request
export const LeaveCurrentChannelRequestSchema = z.object({
  type: z.literal("leaveCurrentChannelRequest"),
  payload: z.object({}),
  meta: z.object({ requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type LeaveCurrentChannelRequest = z.infer<typeof LeaveCurrentChannelRequestSchema>

// LeaveCurrentChannelResponse - LeaveCurrentChannel Response
export const LeaveCurrentChannelResponseSchema = z.object({
  type: z.literal("leaveCurrentChannelResponse"),
  payload: z.union([
    z.object({}),
    z.object({
      error: z.enum([
        "AccessDenied",
        "CreationFailed",
        "MalformedContext",
        "NoChannelFound",
        "ApiTimeout",
        "InvalidArguments",
      ]),
    }),
  ]),
  meta: z.object({ responseUuid: z.string(), requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type LeaveCurrentChannelResponse = z.infer<typeof LeaveCurrentChannelResponseSchema>

// OpenRequest - Open Request
export const OpenRequestSchema = z.object({
  type: z.literal("openRequest"),
  payload: z.object({
    app: z.object({
      appId: z.string(),
      instanceId: z.string().optional(),
      desktopAgent: z.string().optional(),
    }),
    context: ContextSchema.optional(),
  }),
  meta: z.object({ requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type OpenRequest = z.infer<typeof OpenRequestSchema>

// OpenResponse - Open Response
export const OpenResponseSchema = z.object({
  type: z.literal("openResponse"),
  payload: z.union([
    z.object({
      appIdentifier: z.object({
        appId: z.string(),
        instanceId: z.string().optional(),
        desktopAgent: z.string().optional(),
      }),
    }),
    z.object({
      error: z.union([
        z.enum([
          "AppNotFound",
          "AppTimeout",
          "DesktopAgentNotFound",
          "ErrorOnLaunch",
          "MalformedContext",
          "ResolverUnavailable",
          "ApiTimeout",
          "InvalidArguments",
        ]),
        z.enum([
          "AgentDisconnected",
          "NotConnectedToBridge",
          "ResponseToBridgeTimedOut",
          "MalformedMessage",
        ]),
      ]),
    }),
  ]),
  meta: z.object({ responseUuid: z.string(), requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type OpenResponse = z.infer<typeof OpenResponseSchema>

// PrivateChannelAddEventListenerRequest - PrivateChannelAddEventListener Request
export const PrivateChannelAddEventListenerRequestSchema = z.object({
  type: z.literal("privateChannelAddEventListenerRequest"),
  payload: z.object({
    privateChannelId: z.string(),
    listenerType: z.union([z.enum(["addContextListener", "unsubscribe", "disconnect"]), z.null()]),
  }),
  meta: z.object({ requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type PrivateChannelAddEventListenerRequest = z.infer<
  typeof PrivateChannelAddEventListenerRequestSchema
>

// PrivateChannelAddEventListenerResponse - PrivateChannelAddEventListener Response
export const PrivateChannelAddEventListenerResponseSchema = z.object({
  type: z.literal("privateChannelAddEventListenerResponse"),
  payload: z.union([
    z.object({ listenerUUID: z.string() }),
    z.object({
      error: z.enum([
        "AccessDenied",
        "CreationFailed",
        "MalformedContext",
        "NoChannelFound",
        "ApiTimeout",
        "InvalidArguments",
      ]),
    }),
  ]),
  meta: z.object({ responseUuid: z.string(), requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type PrivateChannelAddEventListenerResponse = z.infer<
  typeof PrivateChannelAddEventListenerResponseSchema
>

// PrivateChannelDisconnectRequest - PrivateChannelDisconnect Request
export const PrivateChannelDisconnectRequestSchema = z.object({
  type: z.literal("privateChannelDisconnectRequest"),
  payload: z.object({ channelId: z.string() }),
  meta: z.object({ requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type PrivateChannelDisconnectRequest = z.infer<typeof PrivateChannelDisconnectRequestSchema>

// PrivateChannelDisconnectResponse - PrivateChannelDisconnect Response
export const PrivateChannelDisconnectResponseSchema = z.object({
  type: z.literal("privateChannelDisconnectResponse"),
  payload: z.union([
    z.object({}),
    z.object({
      error: z.enum([
        "AccessDenied",
        "CreationFailed",
        "MalformedContext",
        "NoChannelFound",
        "ApiTimeout",
        "InvalidArguments",
      ]),
    }),
  ]),
  meta: z.object({ responseUuid: z.string(), requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type PrivateChannelDisconnectResponse = z.infer<
  typeof PrivateChannelDisconnectResponseSchema
>

// PrivateChannelOnAddContextListenerEvent - privateChannelOnAddContextListener Event
export const PrivateChannelOnAddContextListenerEventSchema = z.object({
  type: z.literal("privateChannelOnAddContextListenerEvent"),
  payload: z.object({ privateChannelId: z.string(), contextType: z.union([z.string(), z.null()]) }),
  meta: z.object({ eventUuid: z.string(), timestamp: z.coerce.date() }),
})

export type PrivateChannelOnAddContextListenerEvent = z.infer<
  typeof PrivateChannelOnAddContextListenerEventSchema
>

// PrivateChannelOnDisconnectEvent - privateChannelOnDisconnect Event
export const PrivateChannelOnDisconnectEventSchema = z.object({
  type: z.literal("privateChannelOnDisconnectEvent"),
  payload: z.object({ privateChannelId: z.string() }),
  meta: z.object({ eventUuid: z.string(), timestamp: z.coerce.date() }),
})

export type PrivateChannelOnDisconnectEvent = z.infer<typeof PrivateChannelOnDisconnectEventSchema>

// PrivateChannelOnUnsubscribeEvent - PrivateChannelOnUnsubscribe Event
export const PrivateChannelOnUnsubscribeEventSchema = z.object({
  type: z.literal("privateChannelOnUnsubscribeEvent"),
  payload: z.object({ privateChannelId: z.string(), contextType: z.union([z.string(), z.null()]) }),
  meta: z.object({ eventUuid: z.string(), timestamp: z.coerce.date() }),
})

export type PrivateChannelOnUnsubscribeEvent = z.infer<
  typeof PrivateChannelOnUnsubscribeEventSchema
>

// PrivateChannelUnsubscribeEventListenerRequest - PrivateChannelUnsubscribeEventListener Request
export const PrivateChannelUnsubscribeEventListenerRequestSchema = z.object({
  type: z.literal("privateChannelUnsubscribeEventListenerRequest"),
  payload: z.object({ listenerUUID: z.string() }),
  meta: z.object({ requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type PrivateChannelUnsubscribeEventListenerRequest = z.infer<
  typeof PrivateChannelUnsubscribeEventListenerRequestSchema
>

// PrivateChannelUnsubscribeEventListenerResponse - PrivateChannelUnsubscribeEventListener Response
export const PrivateChannelUnsubscribeEventListenerResponseSchema = z.object({
  type: z.literal("privateChannelUnsubscribeEventListenerResponse"),
  payload: z.unknown().optional(),
  meta: z.object({ responseUuid: z.string(), requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type PrivateChannelUnsubscribeEventListenerResponse = z.infer<
  typeof PrivateChannelUnsubscribeEventListenerResponseSchema
>

// RaiseIntentForContextRequest - RaiseIntentForContext Request
export const RaiseIntentForContextRequestSchema = z.object({
  type: z.literal("raiseIntentForContextRequest"),
  payload: z.object({
    context: ContextSchema,
    app: z.object({
      appId: z.string(),
      instanceId: z.string().optional(),
      desktopAgent: z.string().optional(),
    }),
  }),
  meta: z.object({ requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type RaiseIntentForContextRequest = z.infer<typeof RaiseIntentForContextRequestSchema>

// RaiseIntentForContextResponse - RaiseIntentForContext Response
export const RaiseIntentForContextResponseSchema = z.object({
  type: z.literal("raiseIntentForContextResponse"),
  payload: z.union([
    z.object({
      intentResolution: z.object({
        source: z.object({
          appId: z.string(),
          instanceId: z.string().optional(),
          desktopAgent: z.string().optional(),
        }),
        intent: z.string(),
      }),
    }),
    z.object({
      appIntents: z.array(
        z.object({
          intent: z.object({ name: z.string(), displayName: z.string().optional() }),
          apps: z.array(
            z.object({
              name: z.string().optional(),
              version: z.string().optional(),
              instanceMetadata: z.record(z.string(), z.unknown()).optional(),
              title: z.string().optional(),
              tooltip: z.string().optional(),
              description: z.string().optional(),
              icons: z.array(z.unknown()).optional(),
              screenshots: z.array(z.unknown()).optional(),
              resultType: z.unknown().optional(),
              appId: z.string(),
              instanceId: z.string().optional(),
              desktopAgent: z.string().optional(),
            })
          ),
        })
      ),
    }),
    z.object({
      error: z.union([
        z.enum([
          "DesktopAgentNotFound",
          "IntentDeliveryFailed",
          "MalformedContext",
          "NoAppsFound",
          "ResolverTimeout",
          "ResolverUnavailable",
          "TargetAppUnavailable",
          "TargetInstanceUnavailable",
          "UserCancelledResolution",
          "ApiTimeout",
          "InvalidArguments",
        ]),
        z.enum([
          "AgentDisconnected",
          "NotConnectedToBridge",
          "ResponseToBridgeTimedOut",
          "MalformedMessage",
        ]),
      ]),
    }),
  ]),
  meta: z.object({ responseUuid: z.string(), requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type RaiseIntentForContextResponse = z.infer<typeof RaiseIntentForContextResponseSchema>

// RaiseIntentRequest - RaiseIntent Request
export const RaiseIntentRequestSchema = z.object({
  type: z.literal("raiseIntentRequest"),
  payload: z.object({
    intent: z.string(),
    context: ContextSchema,
    app: z
      .union([
        z.string(), // App ID as string
        z.object({
          appId: z.string(),
          instanceId: z.string().optional(),
          desktopAgent: z.string().optional(),
        }), // AppIdentifier object
      ])
      .optional(),
  }),
  meta: z.object({ requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type RaiseIntentRequest = z.infer<typeof RaiseIntentRequestSchema>

// RaiseIntentResponse - RaiseIntent Response
export const RaiseIntentResponseSchema = z.object({
  type: z.literal("raiseIntentResponse"),
  payload: z.union([
    z.object({
      intentResolution: z.object({
        source: z.object({
          appId: z.string(),
          instanceId: z.string().optional(),
          desktopAgent: z.string().optional(),
        }),
        intent: z.string(),
      }),
    }),
    z.object({
      appIntent: z.object({
        intent: z.object({ name: z.string(), displayName: z.string().optional() }),
        apps: z.array(
          z.object({
            name: z.string().optional(),
            version: z.string().optional(),
            instanceMetadata: z.record(z.string(), z.unknown()).optional(),
            title: z.string().optional(),
            tooltip: z.string().optional(),
            description: z.string().optional(),
            icons: z.array(z.unknown()).optional(),
            screenshots: z.array(z.unknown()).optional(),
            resultType: z.unknown().optional(),
            appId: z.string(),
            instanceId: z.string().optional(),
            desktopAgent: z.string().optional(),
          })
        ),
      }),
    }),
    z.object({
      error: z.union([
        z.enum([
          "DesktopAgentNotFound",
          "IntentDeliveryFailed",
          "MalformedContext",
          "NoAppsFound",
          "ResolverTimeout",
          "ResolverUnavailable",
          "TargetAppUnavailable",
          "TargetInstanceUnavailable",
          "UserCancelledResolution",
          "ApiTimeout",
          "InvalidArguments",
        ]),
        z.enum([
          "AgentDisconnected",
          "NotConnectedToBridge",
          "ResponseToBridgeTimedOut",
          "MalformedMessage",
        ]),
      ]),
    }),
  ]),
  meta: z.object({ responseUuid: z.string(), requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type RaiseIntentResponse = z.infer<typeof RaiseIntentResponseSchema>

// RaiseIntentResultResponse - RaiseIntentResult Response
export const RaiseIntentResultResponseSchema = z.object({
  type: z.literal("raiseIntentResultResponse"),
  payload: z.union([
    z.object({ intentResult: z.unknown() }),
    z.object({
      error: z.union([
        z.enum([
          "AccessDenied",
          "CreationFailed",
          "MalformedContext",
          "NoChannelFound",
          "ApiTimeout",
          "InvalidArguments",
        ]),
        z.enum([
          "AppNotFound",
          "AppTimeout",
          "DesktopAgentNotFound",
          "ErrorOnLaunch",
          "MalformedContext",
          "ResolverUnavailable",
          "ApiTimeout",
          "InvalidArguments",
        ]),
        z.enum([
          "DesktopAgentNotFound",
          "IntentDeliveryFailed",
          "MalformedContext",
          "NoAppsFound",
          "ResolverTimeout",
          "ResolverUnavailable",
          "TargetAppUnavailable",
          "TargetInstanceUnavailable",
          "UserCancelledResolution",
          "ApiTimeout",
          "InvalidArguments",
        ]),
        z.enum(["IntentHandlerRejected", "NoResultReturned", "ApiTimeout"]),
        z.enum([
          "AgentDisconnected",
          "NotConnectedToBridge",
          "ResponseToBridgeTimedOut",
          "MalformedMessage",
        ]),
      ]),
    }),
  ]),
  meta: z.object({ responseUuid: z.string(), requestUuid: z.string(), timestamp: z.coerce.date() }),
})

export type RaiseIntentResultResponse = z.infer<typeof RaiseIntentResultResponseSchema>

// Union of all DACP message schemas
export const DACPMessageSchema = z.union([
  WCP1HelloSchema,
  WCP2LoadUrlSchema,
  WCP3HandshakeSchema,
  WCP4ValidateAppIdentitySchema,
  WCP5ValidateAppIdentityFailedResponseSchema,
  WCP5ValidateAppIdentityResponseSchema,
  WCP6GoodbyeSchema,
  WCPConnectionStepSchema,
  AddContextListenerRequestSchema,
  AddContextListenerResponseSchema,
  AddEventListenerRequestSchema,
  AddEventListenerResponseSchema,
  AddIntentListenerRequestSchema,
  AddIntentListenerResponseSchema,
  BroadcastEventSchema,
  BroadcastRequestSchema,
  BroadcastResponseSchema,
  ChannelChangedEventSchema,
  ContextListenerUnsubscribeRequestSchema,
  ContextListenerUnsubscribeResponseSchema,
  CreatePrivateChannelRequestSchema,
  CreatePrivateChannelResponseSchema,
  EventListenerUnsubscribeRequestSchema,
  EventListenerUnsubscribeResponseSchema,
  Fdc3UserInterfaceChannelSelectedSchema,
  Fdc3UserInterfaceChannelsSchema,
  Fdc3UserInterfaceDragSchema,
  Fdc3UserInterfaceHandshakeSchema,
  Fdc3UserInterfaceHelloSchema,
  Fdc3UserInterfaceMessageSchema,
  Fdc3UserInterfaceResolveSchema,
  Fdc3UserInterfaceResolveActionSchema,
  Fdc3UserInterfaceRestyleSchema,
  FindInstancesRequestSchema,
  FindInstancesResponseSchema,
  FindIntentRequestSchema,
  FindIntentResponseSchema,
  FindIntentsByContextRequestSchema,
  FindIntentsByContextResponseSchema,
  GetAppMetadataRequestSchema,
  GetAppMetadataResponseSchema,
  GetCurrentChannelRequestSchema,
  GetCurrentChannelResponseSchema,
  GetCurrentContextRequestSchema,
  GetCurrentContextResponseSchema,
  GetInfoRequestSchema,
  GetInfoResponseSchema,
  GetOrCreateChannelRequestSchema,
  GetOrCreateChannelResponseSchema,
  GetUserChannelsRequestSchema,
  GetUserChannelsResponseSchema,
  HeartbeatAcknowledgmentRequestSchema,
  HeartbeatEventSchema,
  IntentEventSchema,
  IntentListenerUnsubscribeRequestSchema,
  IntentListenerUnsubscribeResponseSchema,
  IntentResultRequestSchema,
  IntentResultResponseSchema,
  JoinUserChannelRequestSchema,
  JoinUserChannelResponseSchema,
  LeaveCurrentChannelRequestSchema,
  LeaveCurrentChannelResponseSchema,
  OpenRequestSchema,
  OpenResponseSchema,
  PrivateChannelAddEventListenerRequestSchema,
  PrivateChannelAddEventListenerResponseSchema,
  PrivateChannelDisconnectRequestSchema,
  PrivateChannelDisconnectResponseSchema,
  PrivateChannelOnAddContextListenerEventSchema,
  PrivateChannelOnDisconnectEventSchema,
  PrivateChannelOnUnsubscribeEventSchema,
  PrivateChannelUnsubscribeEventListenerRequestSchema,
  PrivateChannelUnsubscribeEventListenerResponseSchema,
  RaiseIntentForContextRequestSchema,
  RaiseIntentForContextResponseSchema,
  RaiseIntentRequestSchema,
  RaiseIntentResponseSchema,
  RaiseIntentResultResponseSchema,
])

export type DACPMessage = z.infer<typeof DACPMessageSchema>

// Message type guards
export function isDACPRequest(message: unknown): message is BaseDACPMessage {
  const result = BaseDACPMessageSchema.safeParse(message)
  return (
    result.success &&
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    typeof message.type === "string" &&
    message.type.endsWith("Request")
  )
}

export function isDACPResponse(message: unknown): message is BaseDACPMessage {
  const result = BaseDACPMessageSchema.safeParse(message)
  return (
    result.success &&
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    typeof message.type === "string" &&
    message.type.endsWith("Response")
  )
}

export function isDACPEvent(message: unknown): message is BaseDACPMessage {
  const result = BaseDACPMessageSchema.safeParse(message)
  return (
    result.success &&
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    typeof message.type === "string" &&
    message.type.endsWith("Event")
  )
}
