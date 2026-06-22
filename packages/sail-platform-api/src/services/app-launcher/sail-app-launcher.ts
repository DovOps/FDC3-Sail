/**
 * Sail App Launcher
 *
 * Browser-based app launcher for Sail FDC3 implementation.
 * Launches apps by sending messages to the Sail UI to open apps in
 * iframes, tabs, or windows.
 */

import type { AppLauncher, DirectoryApp } from "@finos/sail-desktop-agent"
import type { AppMetadata, AppIdentifier, BrowserTypes } from "@finos/fdc3"
import { generateUuid } from "../../utils/uuid"

/**
 * Extended app metadata that includes directory details.
 * The AppLauncher interface types this as AppMetadata, but the actual
 * data passed by the sail-desktop-agent is DirectoryApp which includes details.
 */
type AppMetadataWithDetails = AppMetadata & Partial<Pick<DirectoryApp, "details">>

/**
 * Configuration for Sail App Launcher
 */
export interface SailAppLauncherConfig {
  /**
   * Callback to notify Sail UI to open an app.
   * The UI is responsible for creating the iframe/tab/window.
   *
   * @param appMetadata - App metadata from directory (includes details with URL)
   * @param instanceId - Generated instance ID
   * @param context - Optional launch context
   * @returns Promise that resolves when UI has initiated the launch
   */
  onLaunchApp: (
    appMetadata: AppMetadataWithDetails,
    instanceId: string,
    context?: unknown
  ) => Promise<void>
}

/**
 * Sail-specific implementation of AppLauncher.
 *
 * This launcher works with the Sail UI to open apps in the browser.
 * It generates instance IDs and delegates to the UI for actual rendering.
 */
export class SailAppLauncher implements AppLauncher {
  constructor(private config: SailAppLauncherConfig) {}

  async launch(
    request: BrowserTypes.OpenRequestPayload,
    appMetadata: AppMetadata
  ): Promise<AppIdentifier> {
    // Generate instance ID if not targeting existing instance
    const instanceId = request.app.instanceId || generateUuid()

    // Cast to extended type (actual data from sail-desktop-agent is DirectoryApp)
    const metadata = appMetadata as AppMetadataWithDetails

    // Determine launch URL from app metadata
    const url = this.extractAppUrl(metadata)
    if (!url) {
      throw new Error(`Cannot launch app ${request.app.appId}: no URL found in app metadata`)
    }

    // Notify Sail UI to open the app
    await this.config.onLaunchApp(metadata, instanceId, request.context)

    // Return launch result
    return {
      appId: request.app.appId,
      instanceId,
    }
  }

  /**
   * Extract app URL from metadata
   */
  private extractAppUrl(appMetadata: AppMetadataWithDetails): string | undefined {
    // DirectoryApp has details for web apps which contains url
    const details = appMetadata.details
    if (details && "url" in details && typeof details.url === "string") {
      return details.url
    }

    // Future: support other URL locations or formats
    return undefined
  }
}
