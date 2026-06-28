import { describe, expect, it, beforeEach, vi } from "vite-plus/test"
import { createWorkspaceStore, type Workspace } from "../../stores/workspace-store"

type PersistedWorkspaceFixture = {
  state: {
    workspaces: [
      string,
      {
        layout: {
          tabs: [
            string,
            {
              panels: unknown[]
            },
          ][]
        }
      },
    ][]
  }
}

const createWorkspace = (): Workspace => ({
  uuid: "workspace-1",
  name: "Demo Workspace",
  timeLastSaved: 123,
  layout: {
    activeTabId: "tab-1",
    dockviewLayout: {
      grid: {
        root: {
          type: "leaf",
          data: {
            views: ["panel-1"],
            activeView: "panel-1",
          },
        },
      },
      panels: {
        "panel-1": {
          id: "panel-1",
          title: "TraderX",
        },
      },
    },
    tabs: new Map([
      [
        "tab-1",
        {
          tabId: "tab-1",
          name: "Main",
          panels: new Map([
            [
              "panel-1",
              {
                panelId: "panel-1",
                appId: "traderx-web",
                title: "TraderX",
                url: "http://localhost:8080/trade",
                icon: null,
              },
            ],
          ]),
        },
      ],
    ]),
  },
})

describe("workspace-store persistence", () => {
  beforeEach(() => {
    const storage = new Map<string, string>()
    Object.assign(localStorage, {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, value)
      }),
      removeItem: vi.fn((key: string) => {
        storage.delete(key)
      }),
      clear: vi.fn(() => {
        storage.clear()
      }),
    })
  })

  it("serializes nested workspace maps as JSON arrays", () => {
    const workspace = createWorkspace()
    const store = createWorkspaceStore({
      initialWorkspaces: [workspace],
      activeWorkspaceId: workspace.uuid,
      storageName: "workspace-store-test",
    })

    store.getState().setDockviewLayout(workspace.uuid, workspace.layout.dockviewLayout)

    const raw = localStorage.getItem("workspace-store-test")
    expect(raw).toBeTruthy()
    const persisted = JSON.parse(raw!) as PersistedWorkspaceFixture
    expect(Array.isArray(persisted.state.workspaces)).toBe(true)
    expect(persisted.state.workspaces[0][0]).toBe("workspace-1")
    expect(Array.isArray(persisted.state.workspaces[0][1].layout.tabs)).toBe(true)
    expect(Array.isArray(persisted.state.workspaces[0][1].layout.tabs[0][1].panels)).toBe(true)
  })

  it("rehydrates persisted workspace arrays back into maps", () => {
    const workspace = createWorkspace()
    localStorage.setItem(
      "workspace-store-test",
      JSON.stringify({
        state: {
          workspaces: [
            [
              workspace.uuid,
              {
                ...workspace,
                layout: {
                  ...workspace.layout,
                  tabs: [
                    [
                      "tab-1",
                      {
                        tabId: "tab-1",
                        name: "Main",
                        panels: [
                          [
                            "panel-1",
                            {
                              panelId: "panel-1",
                              appId: "traderx-web",
                              title: "TraderX",
                              url: "http://localhost:8080/trade",
                              icon: null,
                            },
                          ],
                        ],
                      },
                    ],
                  ],
                },
              },
            ],
          ],
          activeWorkspaceId: workspace.uuid,
        },
        version: 0,
      })
    )

    const store = createWorkspaceStore({ storageName: "workspace-store-test" })
    const rehydrated = store.getState().getWorkspace(workspace.uuid)

    expect(store.getState().workspaces).toBeInstanceOf(Map)
    expect(rehydrated?.layout.tabs).toBeInstanceOf(Map)
    expect(rehydrated?.layout.tabs.get("tab-1")?.panels).toBeInstanceOf(Map)
    expect(store.getState().getPanel(workspace.uuid, "tab-1", "panel-1")?.appId).toBe("traderx-web")
  })

  it("uses configured initial workspaces when there is no persisted state", () => {
    const workspace = createWorkspace()
    const store = createWorkspaceStore({
      initialWorkspaces: [workspace],
      activeWorkspaceId: workspace.uuid,
      storageName: "workspace-store-test",
    })

    expect(store.getState().activeWorkspaceId).toBe(workspace.uuid)
    expect(store.getState().getWorkspace(workspace.uuid)?.name).toBe("Demo Workspace")
  })
})
