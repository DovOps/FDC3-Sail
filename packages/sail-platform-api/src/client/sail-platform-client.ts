import type { PlatformApi } from "./platform-api"
import { LocalStorageBackend, type LocalStorageBackendConfig } from "./local-storage-backend"

/**
 * Configuration for remote storage backend (future use)
 */
export interface RemoteBackendConfig {
  /**
   * REST API URL for remote storage
   */
  restApiUrl?: string

  /**
   * Socket.IO instance for WebSocket-based storage
   */
  socket?: unknown

  /**
   * Enable debug logging
   */
  debug?: boolean
}

/**
 * Configuration for Sail Platform Client
 */
export interface SailPlatformClientConfig {
  /**
   * Storage backend type
   * - "localStorage" - Use browser localStorage (default)
   * - "remote" - Use remote server via REST/WebSocket (future)
   */
  storage?: "localStorage" | "remote"

  /**
   * Configuration for localStorage backend
   */
  localStorage?: LocalStorageBackendConfig

  /**
   * Configuration for remote backend (future)
   */
  remote?: RemoteBackendConfig
}

/**
 * Sail Platform Client - High-level API for Sail-specific features.
 *
 * This class provides a unified interface for Sail Platform features (workspaces,
 * layouts, config) with pluggable storage backends. Defaults to localStorage
 * for client-side storage.
 *
 * @example
 * ```typescript
 * // Default: localStorage (client-side)
 * const client = new SailPlatformClient()
 *
 * // Explicit localStorage with options
 * const client = new SailPlatformClient({
 *   storage: "localStorage",
 *   localStorage: { keyPrefix: "sail_", debug: true }
 * })
 *
 * // Usage
 * const workspaces = await client.getWorkspaces()
 * await client.saveWorkspaceLayout(workspaceId, layout)
 * const config = await client.getConfig()
 * ```
 */
export class SailPlatformClient implements PlatformApi {
  private backend: PlatformApi

  constructor(config?: SailPlatformClientConfig) {
    const storageType = config?.storage ?? "localStorage"

    if (storageType === "remote") {
      // Future: RemoteBackend implementation
      throw new Error("Remote storage backend not yet implemented")
    }

    // Default to localStorage
    this.backend = new LocalStorageBackend(config?.localStorage)
  }

  /**
   * Get all workspaces for the current user.
   */
  async getWorkspaces(): Promise<unknown[]> {
    return this.backend.getWorkspaces()
  }

  /**
   * Get a specific workspace by ID.
   */
  async getWorkspace(workspaceId: string): Promise<unknown> {
    return this.backend.getWorkspace(workspaceId)
  }

  /**
   * Create a new workspace.
   */
  async createWorkspace(name: string, initialLayout?: unknown): Promise<unknown> {
    return this.backend.createWorkspace(name, initialLayout)
  }

  /**
   * Delete a workspace.
   */
  async deleteWorkspace(workspaceId: string): Promise<boolean> {
    return this.backend.deleteWorkspace(workspaceId)
  }

  /**
   * Get the layout for a specific workspace.
   */
  async getWorkspaceLayout(workspaceId: string): Promise<unknown> {
    return this.backend.getWorkspaceLayout(workspaceId)
  }

  /**
   * Save the layout for a specific workspace.
   */
  async saveWorkspaceLayout(workspaceId: string, layout: unknown): Promise<boolean> {
    return this.backend.saveWorkspaceLayout(workspaceId, layout)
  }

  /**
   * Get user configuration.
   */
  async getConfig(): Promise<unknown> {
    return this.backend.getConfig()
  }

  /**
   * Update user configuration.
   */
  async updateConfig(config: unknown): Promise<boolean> {
    return this.backend.updateConfig(config)
  }
}
