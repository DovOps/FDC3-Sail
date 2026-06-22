import type { Context } from "@finos/fdc3"
import { ResolveError } from "@finos/fdc3"
import { addPendingIntent, resolvePendingIntent } from "../../../state/mutators"
import { getInstance, getInstancesByAppId } from "../../../state/selectors"
import { AppInstanceState } from "../../../state/types"
import {
  FDC3ResolveError,
  NoAppsFoundError,
  TargetAppUnavailableError,
  TargetInstanceUnavailableError,
} from "../../../errors/fdc3-errors"
import { attemptIntentDelivery, queueIntentDelivery } from "./intent-delivery-helpers"
import { retrieveAppsById } from "../../../app-directory/app-directory-queries"
import type { DACPHandlerContext, IntentRequestType } from "../../types"
import { shouldWaitForIntentListenerBeforeDelivery } from "./intent-helpers"
import { launchAppAndWaitForInstance } from "./intent-launch-helpers"

type RegisterPendingIntentStateOptions = {
  requestId: string
  intentName: string
  context: Context
  sourceInstanceId: string
  targetInstanceId: string
  targetAppId: string
}

type NormalizedTargetApp = {
  appId: string
  instanceId?: string
}

type ResolveAppTargetInstanceOptions = {
  appId: string
  validatedContext: Context
  preferredInstanceId?: string
  runningListenerInstanceId?: string
  forceLaunch?: boolean
}

export function normalizeTargetApp(target: unknown): NormalizedTargetApp | undefined {
  if (!target) {
    return undefined
  }

  if (typeof target === "string") {
    return { appId: target }
  }

  if (typeof target !== "object") {
    return undefined
  }

  const record = target as Record<string, unknown>
  if (typeof record.appId !== "string") {
    return undefined
  }

  return {
    appId: record.appId,
    instanceId: typeof record.instanceId === "string" ? record.instanceId : undefined,
  }
}

export function validateRequestedTargetAvailability(
  context: DACPHandlerContext,
  targetApp: NormalizedTargetApp | undefined
): void {
  if (!targetApp) {
    return
  }

  const apps = retrieveAppsById(context.getState().appDirectory, targetApp.appId)
  if (apps.length === 0) {
    throw new TargetAppUnavailableError(`App not found in directory: ${targetApp.appId}`)
  }

  if (!targetApp.instanceId) {
    return
  }

  const instance = getInstance(context.getState(), targetApp.instanceId)
  if (!instance) {
    throw new TargetInstanceUnavailableError(
      `Instance not found or terminated: ${targetApp.instanceId}`
    )
  }
}

export async function resolveAppTargetInstance(
  context: DACPHandlerContext,
  options: ResolveAppTargetInstanceOptions
): Promise<{ targetInstanceId: string; targetInstanceIsLaunched: boolean }> {
  const { appId, validatedContext, preferredInstanceId, runningListenerInstanceId } = options

  if (preferredInstanceId) {
    const instance = getInstance(context.getState(), preferredInstanceId)
    if (instance) {
      return { targetInstanceId: instance.instanceId, targetInstanceIsLaunched: false }
    }
  }

  if (runningListenerInstanceId) {
    return { targetInstanceId: runningListenerInstanceId, targetInstanceIsLaunched: false }
  }

  if (options.forceLaunch) {
    const targetInstanceId = await launchAppAndWaitForInstance(appId, context, validatedContext)
    return { targetInstanceId, targetInstanceIsLaunched: true }
  }

  const runningInstances = getInstancesByAppId(context.getState(), appId).filter(
    instance =>
      instance.state === AppInstanceState.CONNECTED || instance.state === AppInstanceState.PENDING
  )
  if (runningInstances.length > 0) {
    const connectedInstances = runningInstances.filter(
      instance => instance.state === AppInstanceState.CONNECTED
    )
    const candidates = connectedInstances.length > 0 ? connectedInstances : runningInstances
    const targetInstance = candidates.reduce((latest, instance) =>
      instance.lastActivity.getTime() > latest.lastActivity.getTime() ? instance : latest
    )
    return { targetInstanceId: targetInstance.instanceId, targetInstanceIsLaunched: false }
  }

  const targetInstanceId = await launchAppAndWaitForInstance(appId, context, validatedContext)
  return { targetInstanceId, targetInstanceIsLaunched: true }
}

export function registerPendingIntentPromise(
  context: DACPHandlerContext,
  requestId: string,
  requestType: IntentRequestType
): void {
  context.pendingIntentPromises.set(requestId, {
    resolve: () => {},
    reject: () => {},
    requestType,
  })
}

export function registerPendingIntentState(
  context: DACPHandlerContext,
  options: RegisterPendingIntentStateOptions
): void {
  context.setState(state => addPendingIntent(state, options))
}

export function schedulePendingIntentDelivery(
  context: DACPHandlerContext,
  requestId: string,
  targetInstanceId: string,
  intentName: string,
  targetInstanceIsLaunched: boolean,
  explicitTargetInstanceId = false
): void {
  const shouldWaitForListener = shouldWaitForIntentListenerBeforeDelivery(
    context,
    targetInstanceId,
    intentName,
    targetInstanceIsLaunched,
    explicitTargetInstanceId
  )

  if (shouldWaitForListener) {
    queueIntentDelivery(context, requestId, true)
  } else {
    attemptIntentDelivery(context, requestId, false)
  }
}

export function attachPendingIntentTimeout(
  context: DACPHandlerContext,
  requestId: string,
  timeoutMs = 30000
): void {
  const timeoutHandle = setTimeout(() => {
    if (context.pendingIntentPromises.has(requestId)) {
      context.pendingIntentPromises.delete(requestId)
      context.setState(state => resolvePendingIntent(state, requestId))
    }
  }, timeoutMs)

  const promiseData = context.pendingIntentPromises.get(requestId)
  if (promiseData) {
    promiseData.timeoutHandle = timeoutHandle
  }
}

export function cleanupPendingIntentRequest(context: DACPHandlerContext, requestId: string): void {
  const pendingEntry = context.pendingIntentPromises.get(requestId)
  if (!pendingEntry) {
    return
  }

  if (pendingEntry.timeoutHandle) {
    clearTimeout(pendingEntry.timeoutHandle)
  }
  if (pendingEntry.deliveryTimeoutHandle) {
    clearTimeout(pendingEntry.deliveryTimeoutHandle)
  }
  context.pendingIntentPromises.delete(requestId)
}

export function mapIntentRaiseErrorToResolveError(error: unknown): ResolveError {
  if (error instanceof NoAppsFoundError) {
    return ResolveError.NoAppsFound
  }
  if (error instanceof TargetAppUnavailableError) {
    return ResolveError.TargetAppUnavailable
  }
  if (error instanceof TargetInstanceUnavailableError) {
    return ResolveError.TargetInstanceUnavailable
  }
  if (error instanceof FDC3ResolveError) {
    return error.errorType
  }

  return ResolveError.IntentDeliveryFailed
}
