import type { IDockviewHeaderActionsProps } from "dockview"
import { useState, useEffect, useRef, useCallback } from "react"
import { ExternalLink, Maximize2, Minimize2, X } from "lucide-react"

import { ChannelSelector } from "../../../ChannelSelector"
import { useConnectionStore } from "../../../../contexts"

import { Icon } from "./Icon"

import "./controls.css"

// Popout button component with its own state and logic
const PopoutButton = (props: IDockviewHeaderActionsProps) => {
  const [isPopout, setIsPopout] = useState<boolean>(props.api.location.type === "popout")

  useEffect(() => {
    const locationDisposable = props.api.onDidLocationChange(() => {
      setIsPopout(props.api.location.type === "popout")
    })

    return () => {
      locationDisposable.dispose()
    }
  }, [props.api])

  const handlePopoutToggle = () => {
    if (props.api.location.type !== "popout") {
      // Create new popout window
      props.containerApi
        .addPopoutGroup(props.group)
        .then(() => {
          // Optional: Move panel to right position after popout
          // props.api.moveTo({ position: "right" })
        })
        .catch(error => {
          console.error("Failed to create popout window:", error)
        })
    } else {
      // Return from popout to main window
      props.api.moveTo({ position: "right" })
    }
  }

  return (
    <Icon
      title={isPopout ? "Close Window" : "Open In New Window"}
      icon={isPopout ? X : ExternalLink}
      onClick={handlePopoutToggle}
    />
  )
}

// Maximize button component with its own state and logic
const MaximizeButton = (props: IDockviewHeaderActionsProps) => {
  const [isMaximized, setIsMaximized] = useState<boolean>(props.containerApi.hasMaximizedGroup())

  useEffect(() => {
    const maximizedDisposable = props.containerApi.onDidMaximizedGroupChange(() => {
      setIsMaximized(props.containerApi.hasMaximizedGroup())
    })

    return () => {
      maximizedDisposable.dispose()
    }
  }, [props.containerApi])

  const handleMaximizeToggle = () => {
    if (props.containerApi.hasMaximizedGroup()) {
      props.containerApi.exitMaximizedGroup()
    } else {
      props.activePanel?.api.maximize()
    }
  }

  return (
    <Icon
      title={isMaximized ? "Minimize View" : "Maximize View"}
      icon={isMaximized ? Minimize2 : Maximize2}
      onClick={handleMaximizeToggle}
    />
  )
}

// Channel selector button that shows the active panel's FDC3 channel
// Each instance should be independent and only show/update for its specific panelId
const ChannelSelectorButton = ({ activePanelId }: { activePanelId?: string }) => {
  const connectionStore = useConnectionStore()

  if (!activePanelId) {
    return null
  }

  const connection = connectionStore.getConnectionByPanelId(activePanelId)

  if (!connection) {
    return <div className="w-4 h-4 rounded-full bg-gray-200 animate-pulse" />
  }

  return <ChannelSelector instanceId={connection.instanceId} />
}

/**
 * RightControls component renders action buttons for the right side of the panel header
 * Composes individual button components with their own state management
 */
export const RightControls = (props: IDockviewHeaderActionsProps) => {
  const isPopout = props.api.location.type === "popout"
  const [panelId, setPanelId] = useState<string | undefined>(undefined)
  const panelIdRef = useRef<string | undefined>(undefined)

  type PanelParams = { panel?: { panelId: string } } | undefined
  const extractPanelId = useCallback((params: unknown): string | undefined => {
    return (params as PanelParams)?.panel?.panelId
  }, [])

  /**
   * Resolves the panel ID for this header component.
   *
   * Dockview headers are rendered per tab, but props.api.id may be a Dockview internal ID
   * rather than the actual panel ID stored in params.panel.panelId. This function searches
   * through available panels to find the matching panel and extract its panelId.
   *
   * When there are multiple tabs in a panel group, props.activePanel represents the currently
   * active/visible panel and should be used to determine which panel's channel selector to show.
   *
   * @returns The panel ID if found, undefined otherwise
   */
  const resolvePanelId = useCallback((): string | undefined => {
    // When there are multiple tabs in a group, use the active panel (currently visible tab)
    // This ensures the channel selector shows for the active tab, not just when there's one tab
    if (props.activePanel) {
      const panelId = extractPanelId(props.activePanel.params)
      if (panelId) return panelId
    }

    // Search within the group first
    if (props.group) {
      const groupPanels = props.group.panels

      // Match by panel.api.id or panel.id
      for (const panel of groupPanels) {
        if (panel.api.id === props.api.id || panel.id === props.api.id) {
          const panelId = extractPanelId(panel.params)
          if (panelId) return panelId
        }
      }

      // Fallback: if only one panel in group, use it
      if (groupPanels.length === 1) {
        const panelId = extractPanelId(groupPanels[0].params)
        if (panelId) return panelId
      }
    }

    // Search all panels if not found in group
    for (const panel of props.containerApi.panels) {
      if (panel.api.id === props.api.id || panel.id === props.api.id) {
        const panelId = extractPanelId(panel.params)
        if (panelId) return panelId
      }
    }

    // Last resort: use props.api.id if it matches our panel ID format
    if (props.api.id && (props.api.id.startsWith("sail-") || props.api.id.includes("-"))) {
      return props.api.id
    }

    return undefined
  }, [extractPanelId, props.activePanel, props.api.id, props.containerApi.panels, props.group])

  // Sync ref with state
  useEffect(() => {
    panelIdRef.current = panelId
  }, [panelId])

  // Resolve panelId and update state when it changes
  // Use activePanel as the primary source, but persist the value to avoid flickering
  // This handles both initial resolution and tab switching
  useEffect(() => {
    const resolvedId = resolvePanelId()
    const currentPanelId = panelIdRef.current

    // Always update if we have a valid resolvedId and it's different
    // This handles both initial load and tab switching
    if (resolvedId && resolvedId !== currentPanelId) {
      if (process.env.NODE_ENV === "development") {
        console.log("[RightControls] Updating panelId:", {
          from: currentPanelId,
          to: resolvedId,
          activePanel: props.activePanel ? extractPanelId(props.activePanel.params) : null,
        })
      }
      setPanelId(resolvedId)
      return
    }

    // If we couldn't resolve, check if we should clear the panelId
    // Only clear if activePanel is explicitly null/undefined AND we can't find the panel in the group
    if (!resolvedId) {
      // If activePanel exists but we couldn't resolve, don't clear - it might be a timing issue
      if (props.activePanel) {
        // activePanel exists but resolvePanelId returned undefined
        // This shouldn't happen, but don't clear panelId in case it's a temporary issue
        if (process.env.NODE_ENV === "development") {
          console.warn("[RightControls] activePanel exists but resolvePanelId returned undefined", {
            activePanel: props.activePanel,
            currentPanelId,
          })
        }
        return
      }

      // activePanel is null/undefined - check if current panelId is still valid
      if (props.group && currentPanelId) {
        const groupPanels = props.group.panels
        let foundMatch = false
        for (const panel of groupPanels) {
          const id = extractPanelId(panel.params)
          if (id === currentPanelId) {
            foundMatch = true
            break
          }
        }
        // Only clear if we can't find the panel in the group anymore
        if (!foundMatch) {
          if (process.env.NODE_ENV === "development") {
            console.log("[RightControls] Clearing panelId - not found in group", {
              panelId: currentPanelId,
              groupPanels: groupPanels.map(p => extractPanelId(p.params)),
            })
          }
          setPanelId(undefined)
        }
      } else if (!props.group && currentPanelId) {
        // No group, clear if we can't resolve
        setPanelId(undefined)
      }
    }
  }, [
    extractPanelId,
    resolvePanelId,
    props.activePanel,
    props.api.id,
    props.group,
    props.containerApi.panels,
  ])

  if (process.env.NODE_ENV === "development" && !panelId) {
    console.warn("[RightControls] Could not resolve panelId for header", {
      "props.api.id": props.api.id,
      "group?.panels.length": props.group?.panels.length,
      activePanel: props.activePanel ? extractPanelId(props.activePanel.params) : null,
    })
  }

  const isFDC3Panel = !!panelId

  return (
    <div className="group-control">
      {/* Render ChannelSelectorButton when we have a valid panelId */}
      {isFDC3Panel && panelId && <ChannelSelectorButton activePanelId={panelId} />}
      <PopoutButton {...props} />
      {/* Maximize/Minimize button (only show when not in popout) */}
      {!isPopout && <MaximizeButton {...props} />}
    </div>
  )
}
