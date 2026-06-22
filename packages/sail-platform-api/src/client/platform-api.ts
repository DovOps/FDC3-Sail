/**
 * Interface for Sail Platform API operations.
 *
 * This interface defines Sail-specific features (workspaces, layouts, config)
 * that can be implemented with different storage backends:
 * - LocalStorage (default, client-side)
 * - IndexedDB (client-side, larger storage)
 * - REST/WebSocket (remote, server-side)
 */
export interface PlatformApi {
  /**
   * Get all workspaces for the current user.
   * @returns A promise that resolves with an array of workspace objects.
   */
  getWorkspaces(): Promise<unknown[]>

  /**
   * Get a specific workspace by ID.
   * @param workspaceId The workspace identifier
   * @returns A promise that resolves with the workspace object or null if not found
   */
  getWorkspace(workspaceId: string): Promise<unknown>

  /**
   * Create a new workspace.
   * @param name The workspace name
   * @param initialLayout Optional initial layout data
   * @returns A promise that resolves with the created workspace
   */
  createWorkspace(name: string, initialLayout?: unknown): Promise<unknown>

  /**
   * Delete a workspace.
   * @param workspaceId The workspace identifier
   * @returns A promise that resolves to true on success
   */
  deleteWorkspace(workspaceId: string): Promise<boolean>

  /**
   * Get the layout for a specific workspace.
   * @param workspaceId The workspace identifier
   * @returns A promise that resolves with the workspace layout
   */
  getWorkspaceLayout(workspaceId: string): Promise<unknown>

  /**
   * Save the layout for a specific workspace.
   * @param workspaceId The workspace identifier
   * @param layout The layout data to save
   * @returns A promise that resolves to true on success
   */
  saveWorkspaceLayout(workspaceId: string, layout: unknown): Promise<boolean>

  /**
   * Get user configuration.
   * @returns A promise that resolves with the user configuration
   */
  getConfig(): Promise<unknown>

  /**
   * Update user configuration.
   * @param config The configuration data to update
   * @returns A promise that resolves to true on success
   */
  updateConfig(config: unknown): Promise<boolean>
}
