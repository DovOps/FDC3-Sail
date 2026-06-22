import type { PlatformApi } from "./platform-api"

/**
 * Configuration for LocalStorage backend
 */
export interface LocalStorageBackendConfig {
  /**
   * Prefix for localStorage keys (default: "sail_")
   */
  keyPrefix?: string

  /**
   * Enable debug logging
   */
  debug?: boolean
}

/**
 * LocalStorage implementation of Sail Platform API.
 *
 * This is the default implementation that stores workspaces, layouts, and config
 * in the browser's localStorage. Suitable for single-user, client-side storage.
 *
 * @example
 * ```typescript
 * const backend = new LocalStorageBackend({
 *   keyPrefix: "sail_",
 *   debug: true
 * })
 *
 * const workspaces = await backend.getWorkspaces()
 * await backend.saveWorkspaceLayout(workspaceId, layout)
 * ```
 */
export class LocalStorageBackend implements PlatformApi {
  private keyPrefix: string
  private debug: boolean

  constructor(config?: LocalStorageBackendConfig) {
    this.keyPrefix = config?.keyPrefix ?? "sail_"
    this.debug = config?.debug ?? false
  }

  private getKey(name: string): string {
    return `${this.keyPrefix}${name}`
  }

  private getItem<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(this.getKey(key))
      if (!item) return null
      return JSON.parse(item) as T
    } catch (error) {
      if (this.debug) {
        console.error(`[LocalStorageBackend] Error reading ${key}:`, error)
      }
      return null
    }
  }

  private setItem(key: string, value: unknown): void {
    try {
      localStorage.setItem(this.getKey(key), JSON.stringify(value))
    } catch (error) {
      if (this.debug) {
        console.error(`[LocalStorageBackend] Error writing ${key}:`, error)
      }
      throw error
    }
  }

  async getWorkspaces(): Promise<unknown[]> {
    return Promise.resolve(this.getItem<unknown[]>("workspaces") ?? [])
  }

  async getWorkspace(workspaceId: string): Promise<unknown> {
    const workspaces = this.getItem<unknown[]>("workspaces") ?? []
    const workspace = (workspaces as Array<{ id?: string; uuid?: string }>).find(
      w => w.id === workspaceId || w.uuid === workspaceId
    )
    return Promise.resolve(workspace ?? null)
  }

  private generateUUID(): string {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID()
    }
    // Fallback UUID v4 generator
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0
      const v = c === "x" ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  async createWorkspace(name: string, initialLayout?: unknown): Promise<unknown> {
    const workspaces = this.getItem<unknown[]>("workspaces") ?? []
    const workspace = {
      uuid: this.generateUUID(),
      id: this.generateUUID(),
      name,
      timeLastSaved: Date.now(),
      layout: initialLayout ?? null,
    }
    workspaces.push(workspace)
    this.setItem("workspaces", workspaces)
    return Promise.resolve(workspace)
  }

  async deleteWorkspace(workspaceId: string): Promise<boolean> {
    const workspaces = this.getItem<unknown[]>("workspaces") ?? []
    const filtered = (workspaces as Array<{ id?: string; uuid?: string }>).filter(
      w => w.id !== workspaceId && w.uuid !== workspaceId
    )
    this.setItem("workspaces", filtered)
    return Promise.resolve(true)
  }

  async getWorkspaceLayout(workspaceId: string): Promise<unknown> {
    const layout = this.getItem<unknown>(`workspace_layout_${workspaceId}`)
    if (layout) return Promise.resolve(layout)

    // Fallback: check if layout is stored in workspace object
    const workspace = this.getItem<Array<{ id?: string; uuid?: string; layout?: unknown }>>(
      "workspaces"
    )?.find(w => w.id === workspaceId || w.uuid === workspaceId)
    if (workspace && "layout" in workspace) {
      return Promise.resolve(workspace.layout)
    }

    return Promise.resolve(null)
  }

  async saveWorkspaceLayout(workspaceId: string, layout: unknown): Promise<boolean> {
    this.setItem(`workspace_layout_${workspaceId}`, layout)
    return Promise.resolve(true)
  }

  async getConfig(): Promise<unknown> {
    return Promise.resolve(this.getItem<unknown>("config") ?? {})
  }

  async updateConfig(config: unknown): Promise<boolean> {
    this.setItem("config", config)
    return Promise.resolve(true)
  }
}
