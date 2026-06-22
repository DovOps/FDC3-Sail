import { describe, test, expect, beforeEach } from "vite-plus/test"
import { createMockAppPanel } from "../utils/test-utils"
import { createPanelStore } from "../../stores"

let store: ReturnType<typeof createPanelStore>

describe("PanelStore", () => {
  beforeEach(() => {
    // Create fresh store for each test
    store = createPanelStore()
  })

  describe("Initial State", () => {
    test("should have empty panels array initially", () => {
      expect(store.getState().panels).toEqual([])
    })

    test('should have default activeTabId as "One"', () => {
      expect(store.getState().activeTabId).toBe("One")
    })
  })

  describe("Panel Management", () => {
    test("should add a panel", () => {
      const mockPanel = createMockAppPanel({ panelId: "test-panel-1" })

      store.getState().addPanel(mockPanel)

      expect(store.getState().panels).toHaveLength(1)
      expect(store.getState().panels[0]).toEqual(mockPanel)
    })

    test("should remove a panel by panelId", () => {
      const mockPanel = createMockAppPanel({ panelId: "test-panel-1" })

      // Add then remove
      store.getState().addPanel(mockPanel)
      expect(store.getState().panels).toHaveLength(1)

      store.getState().removePanel("test-panel-1")
      expect(store.getState().panels).toHaveLength(0)
    })

    test("should set all panels", () => {
      const mockPanels = [
        createMockAppPanel({ panelId: "panel-1" }),
        createMockAppPanel({ panelId: "panel-2" }),
      ]

      store.getState().setPanels(mockPanels)

      expect(store.getState().panels).toHaveLength(2)
      expect(store.getState().panels).toEqual(mockPanels)
    })

    test("should update existing panel with same panelId", () => {
      const originalPanel = createMockAppPanel({
        panelId: "duplicate-test",
        title: "Original Title",
      })
      const updatedPanel = createMockAppPanel({
        panelId: "duplicate-test",
        title: "Updated Title",
      })

      // Add original panel
      store.getState().addPanel(originalPanel)
      expect(store.getState().panels).toHaveLength(1)
      expect(store.getState().panels[0].title).toBe("Original Title")

      // Add panel with same panelId - should update, not duplicate
      store.getState().addPanel(updatedPanel)
      expect(store.getState().panels).toHaveLength(1)
      expect(store.getState().panels[0].title).toBe("Updated Title")
    })
  })

  describe("Tab Management", () => {
    test("should change active tab", () => {
      expect(store.getState().activeTabId).toBe("One")

      store.getState().setActiveTab("Two")

      expect(store.getState().activeTabId).toBe("Two")
    })

    test("should get panels for specific tab", () => {
      const tabOnePanels = [
        createMockAppPanel({ tabId: "One", panelId: "panel-1" }),
        createMockAppPanel({ tabId: "One", panelId: "panel-2" }),
      ]
      const tabTwoPanel = createMockAppPanel({ tabId: "Two", panelId: "panel-3" })

      // Add all panels
      store.getState().setPanels([...tabOnePanels, tabTwoPanel])

      // Test filtering by tab
      const oneTabResults = store.getState().getTabPanels("One")
      const twoTabResults = store.getState().getTabPanels("Two")

      expect(oneTabResults).toHaveLength(2)
      expect(twoTabResults).toHaveLength(1)
      expect(oneTabResults.every(panel => panel.tabId === "One")).toBe(true)
      expect(twoTabResults[0].tabId).toBe("Two")
    })
  })

  describe("Edge Cases", () => {
    test("should handle removing non-existent panel gracefully", () => {
      const initialState = store.getState().panels

      store.getState().removePanel("non-existent-panel")

      expect(store.getState().panels).toEqual(initialState)
    })

    test("should handle empty panel array", () => {
      store.getState().setPanels([])

      expect(store.getState().panels).toEqual([])
      expect(store.getState().getTabPanels("One")).toEqual([])
    })

    test("should handle getTabPanels with non-existent tab", () => {
      const mockPanels = [createMockAppPanel({ tabId: "One", panelId: "panel-1" })]
      store.getState().setPanels(mockPanels)

      const results = store.getState().getTabPanels("NonExistentTab")

      expect(results).toEqual([])
    })
  })
})
