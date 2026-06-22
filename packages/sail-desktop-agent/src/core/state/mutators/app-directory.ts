/**
 * AgentState mutators for the app directory catalog slice.
 */

import type { DirectoryApp, DirectoryData } from "../../app-directory/types"
import { consoleLogger } from "../../interfaces/logger"
import {
  fetchAppDirectory,
  isValidDirectoryUrl,
  logDirectoryLoadFailure,
  mergeAppsWithoutDuplicates,
  parseDirectoryData,
  validateApplications,
} from "../../app-directory/fetch-app-directory"
import type { AgentState } from "../types"

/** Adds one app without dedupe (config seed). */
export function addApp(state: AgentState, app: DirectoryApp): AgentState {
  return {
    ...state,
    appDirectory: {
      ...state.appDirectory,
      apps: [...state.appDirectory.apps, app],
    },
  }
}

/** Adds apps with duplicate appId skipping and required-field validation. */
/** Removes every catalog entry whose appId matches case-insensitively. */
export function removeApplicationsByAppId(state: AgentState, appId: string): AgentState {
  const normalizedAppId = appId.toLowerCase()
  return {
    ...state,
    appDirectory: {
      ...state.appDirectory,
      apps: state.appDirectory.apps.filter(app => app.appId.toLowerCase() !== normalizedAppId),
    },
  }
}

export function addApplications(
  state: AgentState,
  data: DirectoryApp[] | DirectoryData
): AgentState {
  const applications = parseDirectoryData(data)
  validateApplications(applications)

  return {
    ...state,
    appDirectory: {
      ...state.appDirectory,
      apps: mergeAppsWithoutDuplicates(state.appDirectory.apps, applications),
    },
  }
}

export function addDirectoryUrl(state: AgentState, url: string): AgentState {
  if (!url || typeof url !== "string") {
    throw new Error("Directory URL must be a non-empty string")
  }

  if (!isValidDirectoryUrl(url)) {
    throw new Error(
      `Invalid directory URL: ${url}. ` +
        `Must be a valid http/https REST endpoint. ` +
        `For file system operations, use utilities from @finos/sail-platform-api.`
    )
  }

  if (state.appDirectory.directoryUrls.includes(url)) {
    return state
  }

  return {
    ...state,
    appDirectory: {
      ...state.appDirectory,
      directoryUrls: [...state.appDirectory.directoryUrls, url],
    },
  }
}

export async function loadDirectoryIntoState(state: AgentState, url: string): Promise<AgentState> {
  try {
    let next = addDirectoryUrl(state, url)
    const apps = await fetchAppDirectory(url)
    next = {
      ...next,
      appDirectory: {
        ...next.appDirectory,
        apps: mergeAppsWithoutDuplicates(next.appDirectory.apps, apps),
      },
    }
    return next
  } catch (error) {
    logDirectoryLoadFailure(url, error)
    throw new Error(
      `Failed to load applications from ${url}: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }
}

export function removeDirectoryUrl(state: AgentState, url: string): AgentState {
  return {
    ...state,
    appDirectory: {
      ...state.appDirectory,
      directoryUrls: state.appDirectory.directoryUrls.filter(entry => entry !== url),
    },
  }
}

export function clearDirectoryUrls(state: AgentState): AgentState {
  return {
    ...state,
    appDirectory: {
      ...state.appDirectory,
      directoryUrls: [],
    },
  }
}

export async function replaceDirectoriesInState(
  state: AgentState,
  urls: string[]
): Promise<AgentState> {
  if (!Array.isArray(urls)) {
    throw new Error("URLs must be an array")
  }

  if (urls.length === 0) {
    return {
      ...state,
      appDirectory: { apps: [], directoryUrls: [] },
    }
  }

  const invalidUrls = urls.filter(url => !isValidDirectoryUrl(url))
  if (invalidUrls.length > 0) {
    throw new Error(
      `Invalid directory URLs provided: ${invalidUrls.join(", ")}. ` +
        `Must be valid http/https REST endpoints. ` +
        `For file system operations, use utilities from @finos/sail-platform-api.`
    )
  }

  let next: AgentState = {
    ...state,
    appDirectory: { apps: [], directoryUrls: [...urls] },
  }

  const results = await Promise.allSettled(
    urls.map(async url => {
      next = await loadDirectoryIntoState(next, url)
    })
  )

  const errors = results
    .map((result, index) =>
      result.status === "rejected"
        ? `Failed to load ${urls[index]}: ${(result.reason as Error).message || result.reason}`
        : null
    )
    .filter((error): error is string => error !== null)

  const successCount = results.filter(result => result.status === "fulfilled").length
  consoleLogger.info(
    `Loaded ${next.appDirectory.apps.length} apps from ${successCount}/${urls.length} directory source(s)`
  )

  if (errors.length > 0) {
    consoleLogger.warn("Some directories failed to load:", errors)
  }

  return next
}
