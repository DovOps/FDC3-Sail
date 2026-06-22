import type { DesktopAgentConfig } from "../../desktop-agent"
import { createDACPSuccessResponse } from "../../dacp/dacp-message-creators"
import { type DACPHandlerContext } from "../types"
import { sendDACPResponse, sendDACPErrorResponse } from "./utils/dacp-response-utils"
import type { BrowserTypes } from "@finos/fdc3"
import { OpenError, ResolveError } from "@finos/fdc3"
import {
  AppNotFoundError,
  CloseError,
  ErrorOnLaunchError,
  FDC3OpenError,
} from "../../errors/fdc3-errors"
import type { DirectoryApp } from "../../app-directory/types"
import { retrieveAppsById } from "../../app-directory/app-directory-queries"
import { getInstance, getInstancesByAppId } from "../../state/selectors"
import { connectInstance } from "../../state/mutators"
import { registerOpenWithContext } from "./utils/open-with-context"
import { isValidContext } from "./utils/context-validation"
import { resolveDacpHandlerInstanceId } from "./utils/resolve-context-listener-instance-id"
import { cleanupDACPHandlers } from "./cleanup"

/**
 * Handles getInfoRequest to return implementation metadata.
 */
export function handleGetInfoRequest(
  message: BrowserTypes.GetInfoRequest,
  context: DACPHandlerContext
): void {
  const { responses, instanceId, implementationMetadata, logger, getState } = context

  try {
    const callerInstance = getInstance(getState(), instanceId)
    const provider = implementationMetadata.provider
    let appMetadata: BrowserTypes.AppMetadata | undefined

    if (callerInstance) {
      const directoryApps = retrieveAppsById(getState().appDirectory, callerInstance.appId)
      if (directoryApps.length > 0) {
        appMetadata = convertDirectoryAppToAppMetadata(directoryApps[0], provider, instanceId)
      } else {
        appMetadata = {
          appId: callerInstance.appId,
          name: callerInstance.metadata?.name ?? callerInstance.appId,
          instanceId,
          desktopAgent: provider,
        }
      }
    }

    const resolvedImplementationMetadata: DesktopAgentConfig["implementationMetadata"] & {
      appMetadata?: BrowserTypes.AppMetadata
    } = {
      fdc3Version: implementationMetadata.fdc3Version,
      provider: implementationMetadata.provider,
      providerVersion: implementationMetadata.providerVersion,
      optionalFeatures: implementationMetadata.optionalFeatures,
    }

    if (appMetadata) {
      resolvedImplementationMetadata.appMetadata = appMetadata
    }

    const response = createDACPSuccessResponse(message, "getInfoResponse", {
      implementationMetadata: resolvedImplementationMetadata,
    })

    sendDACPResponse({ response, instanceId, responses })
  } catch (error) {
    logger.error("DACP: getInfoRequest failed", error)
    sendDACPErrorResponse({
      message,
      errorType: OpenError.ApiTimeout,
      errorMessage: error instanceof Error ? error.message : "Failed to get implementation info",
      instanceId,
      responses,
    })
  }
}

/**
 * Handles openRequest to launch an app
 */
export async function handleOpenRequest(
  message: BrowserTypes.OpenRequest,
  context: DACPHandlerContext
): Promise<void> {
  const { responses, instanceId, appLauncher, logger, getState } = context

  try {
    const payload = message.payload

    // Check if app launcher is available
    if (!appLauncher) {
      throw new ErrorOnLaunchError("App launching not available - no AppLauncher configured")
    }

    const appId = payload.app.appId
    const targetInstanceId = payload.app.instanceId
    const launchContext = payload.context

    if (launchContext !== undefined && !isValidContext(launchContext)) {
      sendDACPErrorResponse({
        message,
        errorType: OpenError.MalformedContext,
        errorMessage: "Invalid context: context must be an object with a string type property",
        instanceId,
        responses,
      })
      return
    }

    // Get app metadata from directory
    const apps = retrieveAppsById(getState().appDirectory, appId)
    if (apps.length === 0) {
      throw new AppNotFoundError(`App not found in directory: ${appId}`)
    }
    const appMetadata = apps[0]

    logger.info("DACP: Launching app", {
      appId,
      targetInstanceId,
      hasContext: !!launchContext,
    })

    // Launch the app via injected launcher
    const appIdentifier = await appLauncher.launch(
      {
        app: payload.app,
        context: launchContext,
      },
      appMetadata
    )

    logger.info("DACP: App launched successfully", {
      appId: appIdentifier.appId,
      instanceId: appIdentifier.instanceId,
    })

    const launchedInstanceId = appIdentifier.instanceId
    if (!launchedInstanceId) {
      throw new ErrorOnLaunchError("App launcher did not return an instanceId")
    }

    // Pre-register host-assigned instanceId so findInstances and open-with-context
    // can route to the launcher id before WCP4 validation completes.
    if (!getInstance(context.getState(), launchedInstanceId)) {
      context.setState(state =>
        connectInstance(state, {
          instanceId: launchedInstanceId,
          appId: appMetadata.appId,
          metadata: {
            appId: appMetadata.appId,
            name: appMetadata.name,
            title: appMetadata.title,
            description: appMetadata.description,
            icons: appMetadata.icons,
            screenshots: appMetadata.screenshots,
          },
        })
      )
    }

    if (launchContext) {
      registerOpenWithContext(message, appIdentifier, launchContext, context)
      return
    }

    const response = createDACPSuccessResponse(message, "openResponse", {
      appIdentifier,
    })

    sendDACPResponse({ response, instanceId, responses })
  } catch (error) {
    logger.error("DACP: openRequest failed", error)

    const errorType = error instanceof FDC3OpenError ? error.errorType : OpenError.ErrorOnLaunch
    const errorMessage = error instanceof Error ? error.message : "Failed to open app"

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
 * Handles findInstancesRequest to return all app instances for a given appId
 */
export function handleFindInstancesRequest(
  message: BrowserTypes.FindInstancesRequest,
  context: DACPHandlerContext
): void {
  const { responses, instanceId, getState, logger } = context

  try {
    const { app: appIdentifier } = message.payload

    logger.info("DACP: Finding instances for app", { appId: appIdentifier.appId })

    if (retrieveAppsById(getState().appDirectory, appIdentifier.appId).length === 0) {
      sendDACPErrorResponse({
        message,
        errorType: ResolveError.NoAppsFound,
        errorMessage: `App not found in directory: ${appIdentifier.appId}`,
        instanceId,
        responses,
      })
      return
    }

    // Query for all instances of this app
    const instances = getInstancesByAppId(getState(), appIdentifier.appId)

    // Convert to FDC3 AppIdentifier format
    const appIdentifiers = instances.map(instance => ({
      appId: instance.appId,
      instanceId: instance.instanceId,
    }))

    const response = createDACPSuccessResponse(message, "findInstancesResponse", {
      appIdentifiers,
    })

    sendDACPResponse({ response, instanceId, responses })
  } catch (error) {
    logger.error("DACP: findInstancesRequest failed", error)
    sendDACPErrorResponse({
      message,
      errorType: OpenError.AppNotFound,
      errorMessage: error instanceof Error ? error.message : "Failed to find app instances",
      instanceId,
      responses,
    })
  }
}

/**
 * Helper function to convert DirectoryApp to AppMetadata format
 * Maps FDC3 App Directory fields to FDC3 AppMetadata response format
 *
 * @param app - The DirectoryApp from app directory
 * @param instanceId - Optional instance ID if app is running
 * @returns AppMetadata object ready for DACP response
 */
function convertDirectoryAppToAppMetadata(
  app: DirectoryApp,
  provider: string,
  instanceId?: string
) {
  return {
    appId: app.appId,
    name: app.name,
    version: app.version,
    title: app.title,
    tooltip: app.tooltip,
    description: app.description,
    icons: app.icons || [],
    screenshots: app.screenshots || [],
    instanceId,
    desktopAgent: provider,
  }
}

/**
 * Handles getAppMetadataRequest to return app metadata
 * Returns metadata from running instances or from the App Directory
 */
export function handleGetAppMetadataRequest(
  message: BrowserTypes.GetAppMetadataRequest,
  context: DACPHandlerContext
): void {
  const { responses, instanceId, getState, logger, implementationMetadata } = context
  const provider = implementationMetadata.provider

  try {
    // Parse request payload
    const payload = message.payload
    const appId = payload.app.appId
    const specificInstanceId = payload.app.instanceId

    // Step 1: Try to get metadata from a running instance
    let runningInstance
    if (specificInstanceId) {
      runningInstance = getInstance(getState(), specificInstanceId)
    } else {
      const instances = getInstancesByAppId(getState(), appId)
      runningInstance = instances[0]
    }

    // Step 2: If running instance found, return metadata with instanceId
    if (runningInstance) {
      // Query directory for full metadata
      const directoryApps = retrieveAppsById(getState().appDirectory, appId)
      const directoryApp = directoryApps[0]

      if (directoryApp) {
        // Combine directory metadata with instance information
        const appMetadata = convertDirectoryAppToAppMetadata(
          directoryApp,
          provider,
          runningInstance.instanceId
        )

        const response = createDACPSuccessResponse(message, "getAppMetadataResponse", {
          appMetadata,
        })

        sendDACPResponse({ response, instanceId, responses })
        return
      }

      // Fallback: running instance but no directory entry (shouldn't happen normally)
      logger.warn("DACP: Running instance found but no directory entry", { appId })
      const appMetadata = {
        appId: runningInstance.appId,
        name: runningInstance.appId,
        instanceId: runningInstance.instanceId,
        desktopAgent: provider,
      }

      const response = createDACPSuccessResponse(message, "getAppMetadataResponse", {
        appMetadata,
      })

      sendDACPResponse({ response, instanceId, responses })
      return
    }

    // Step 3: No running instance - fallback to App Directory
    const directoryApps = retrieveAppsById(getState().appDirectory, appId)
    if (directoryApps.length > 0) {
      const appMetadata = convertDirectoryAppToAppMetadata(directoryApps[0], provider)

      const response = createDACPSuccessResponse(message, "getAppMetadataResponse", {
        appMetadata,
      })

      sendDACPResponse({ response, instanceId, responses })
      return
    }

    // Step 4: App not found anywhere - return error
    throw new Error(`No metadata found for app: ${appId}`)
  } catch (error) {
    logger.error("DACP: getAppMetadataRequest failed", error)
    sendDACPErrorResponse({
      message,
      errorType: ResolveError.TargetAppUnavailable,
      errorMessage: error instanceof Error ? error.message : "Failed to get app metadata",
      instanceId,
      responses,
    })
  }
}

/** FDC3 v3.0 closeRequest — not yet in @finos/fdc3 2.2 BrowserTypes. */
export type CloseRequestMessage = {
  type: "closeRequest"
  meta: BrowserTypes.AppRequestMessageMeta
  payload: Record<string, never>
}

/**
 * Handles closeRequest when an app calls fdc3.close() on itself.
 *
 * Self-close only: WCPConnector overwrites `meta.source.instanceId` from the MessagePort
 * connection in production; the handler always closes the resolved caller instance.
 *
 * Per FDC3 v3.0 DACP spec: on success the app container is torn down before a success
 * `closeResponse` can be delivered — only error `closeResponse` is sent. The `@finos/fdc3`
 * v3.0 client treats `CloseError.ApiTimeout` (no response before exchange timeout) as the
 * expected successful outcome.
 */
export async function handleCloseRequest(
  message: CloseRequestMessage,
  context: DACPHandlerContext
): Promise<void> {
  const { responses, appLauncher, logger, getState } = context
  const targetInstanceId = resolveDacpHandlerInstanceId(message, context)

  try {
    const instance = getInstance(getState(), targetInstanceId)
    if (!instance) {
      throw new Error(`Instance not found: ${targetInstanceId}`)
    }

    if (!appLauncher?.close) {
      throw new Error("App close not available - no AppLauncher.close configured")
    }

    logger.info("DACP: Closing app instance", { instanceId: targetInstanceId })

    await appLauncher.close(targetInstanceId)

    cleanupDACPHandlers({ ...context, instanceId: targetInstanceId })
  } catch (error) {
    logger.error("DACP: closeRequest failed", error)
    sendDACPErrorResponse({
      message,
      errorType: CloseError.ErrorOnClose as BrowserTypes.ResponsePayloadError,
      errorMessage: error instanceof Error ? error.message : "Failed to close app instance",
      instanceId: targetInstanceId,
      responses,
    })
  }
}
