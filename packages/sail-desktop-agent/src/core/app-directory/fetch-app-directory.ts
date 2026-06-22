/**
 * FDC3 app directory fetch and validation helpers (REST /v2/apps).
 */

import type { DirectoryApp, DirectoryData } from "./types"
import { consoleLogger } from "../interfaces/logger"

export function parseDirectoryData(data: DirectoryApp[] | DirectoryData): DirectoryApp[] {
  if (Array.isArray(data)) {
    return data
  }
  if (data.applications && Array.isArray(data.applications)) {
    return data.applications
  }
  throw new Error(
    "Invalid data format: expected array of DirectoryApp or DirectoryData with applications array"
  )
}

export function validateApplication(app: DirectoryApp, source?: string): void {
  if (!app.appId || !app.title || !app.type || !app.details) {
    const sourceInfo = source ? ` in ${source}` : ""
    throw new Error(
      `Invalid application${sourceInfo}: missing required fields (appId, title, type, or details)`
    )
  }
}

export function validateApplications(applications: DirectoryApp[], source?: string): void {
  for (const app of applications) {
    validateApplication(app, source)
  }
}

function normalizeDirectoryUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    if (urlObj.pathname.endsWith("/v2/apps")) {
      return url
    }
    const basePath = urlObj.pathname.replace(/\/$/, "")
    urlObj.pathname = `${basePath}/v2/apps`
    return urlObj.toString()
  } catch {
    return url
  }
}

/** Directory URLs must be http/https REST endpoints (FDC3 app directory spec). */
export function isValidDirectoryUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return urlObj.protocol === "http:" || urlObj.protocol === "https:"
  } catch {
    return false
  }
}

/** Fetches and validates apps from a remote /v2/apps endpoint. */
export async function fetchAppDirectory(url: string): Promise<DirectoryApp[]> {
  try {
    const normalizedUrl = normalizeDirectoryUrl(url)
    const response = await fetch(normalizedUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch ${normalizedUrl}: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as DirectoryData | { applications?: DirectoryApp[] }
    const applications = parseDirectoryData(data as DirectoryApp[] | DirectoryData)
    validateApplications(applications, normalizedUrl)
    return applications
  } catch (error) {
    throw new Error(
      `Failed to fetch from ${url}: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/** Merges fetched apps into catalog.apps without duplicate appIds (same policy as addApplications). */
export function mergeAppsWithoutDuplicates(
  existingApps: DirectoryApp[],
  incomingApps: DirectoryApp[]
): DirectoryApp[] {
  const existingAppIds = new Set(existingApps.map(app => app.appId))
  const newApps: DirectoryApp[] = []
  for (const app of incomingApps) {
    if (!existingAppIds.has(app.appId)) {
      existingAppIds.add(app.appId)
      newApps.push(app)
    }
  }
  return [...existingApps, ...newApps]
}

export function logDirectoryLoadFailure(url: string, error: unknown): void {
  const errorMessage = `Failed to load applications from ${url}: ${
    error instanceof Error ? error.message : String(error)
  }`
  consoleLogger.error(errorMessage)
}
