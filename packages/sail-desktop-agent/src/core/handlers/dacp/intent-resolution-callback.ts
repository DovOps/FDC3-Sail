import type { Context } from "@finos/fdc3"
import type {
  HostIntentResolverChoice,
  HostIntentResolverHandler,
  HostIntentResolverResponse,
} from "../../../host-contracts/intent-resolver"

/**
 * Sail-internal DACP handler callback types for host-owned intent resolver UI.
 *
 * These are not official FDC3 DACP wire message types. They describe the
 * callback payload the Desktop Agent core passes to host integration code when
 * it can resolve an app-facing DACP `raiseIntent*` request with host UI.
 */

/** Sail host resolver handler metadata used by internal resolver callbacks. */
export type IntentHandlerOption = HostIntentResolverHandler

/** Sail host resolver choice metadata used by internal resolver callbacks. */
export type IntentResolutionChoice = HostIntentResolverChoice

/**
 * Request payload for host-provided intent resolution.
 */
export interface IntentResolutionRequest {
  /** Unique request ID for correlation. */
  requestId: string

  /** Intent name being raised. */
  intent: string

  /** Context being passed with intent. */
  context: Context

  /** Available handlers to choose from. */
  handlers: IntentHandlerOption[]

  /** Available intent/app choices; may contain multiple intents for raiseIntentForContext. */
  choices?: IntentResolutionChoice[]
}

/** Response from host-provided intent resolution. */
export type IntentResolutionResponse = HostIntentResolverResponse

/**
 * Callback type for requesting host UI-based intent resolution.
 */
export type IntentResolutionCallback = (
  request: IntentResolutionRequest
) => Promise<IntentResolutionResponse>
