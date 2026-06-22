import { create } from "zustand"
import type { AppPanel } from "../components/layout-grid/types"

interface PanelState {
  panels: AppPanel[]
  activeTabId: string
}

interface PanelActions {
  addPanel: (panel: AppPanel) => void
  removePanel: (panelId: string) => void
  setPanels: (panels: AppPanel[]) => void
  setActiveTab: (tabId: string) => void
  getTabPanels: (tabId: string) => AppPanel[]
}

export interface PanelStore extends PanelState, PanelActions {}

export const createPanelStore = () =>
  create<PanelStore>((set, get) => ({
    // Initial state
    panels: [],
    activeTabId: "One",

    // Actions
    addPanel: (panel: AppPanel) =>
      set(state => {
        const existingIndex = state.panels.findIndex(p => p.panelId === panel.panelId)
        if (existingIndex >= 0) {
          // Update existing panel
          const updatedPanels = [...state.panels]
          updatedPanels[existingIndex] = panel
          return { panels: updatedPanels }
        } else {
          // Add new panel
          return { panels: [...state.panels, panel] }
        }
      }),

    removePanel: (panelId: string) =>
      set(state => ({
        panels: state.panels.filter(p => p.panelId !== panelId),
      })),

    setPanels: (panels: AppPanel[]) => set({ panels }),

    setActiveTab: (tabId: string) => set({ activeTabId: tabId }),

    getTabPanels: (tabId: string) => {
      return get().panels.filter(panel => panel.tabId === tabId)
    },
  }))
