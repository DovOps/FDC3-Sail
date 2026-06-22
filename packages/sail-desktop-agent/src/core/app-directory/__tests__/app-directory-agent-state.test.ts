import { describe, expect, it, vi } from "vite-plus/test"
import { DesktopAgent } from "../../desktop-agent"
import { DEFAULT_FDC3_USER_CHANNELS } from "../../default-user-channels"
import { retrieveAllApps, retrieveApps, retrieveAppsById } from "../app-directory-queries"
import { createInitialState } from "../../state/initial-state"
import type { AgentState } from "../../state/types"
import {
  addApp,
  addApplications,
  addDirectoryUrl,
  loadDirectoryIntoState,
  replaceDirectoriesInState,
} from "../../state/mutators/app-directory"
import {
  expectAppDirectoryOnState,
  mockApp1,
  mockApp2,
  mockApp3,
} from "./app-directory-test-fixtures"

type DesktopAgentInternals = {
  state: AgentState
}

function asInternals(agent: DesktopAgent): DesktopAgentInternals {
  return agent as DesktopAgent & DesktopAgentInternals
}

function applyAgentStateUpdate(
  agent: DesktopAgent,
  callback: (state: AgentState) => AgentState
): void {
  const internal = asInternals(agent)
  internal.state = callback(agent.getState())
}

async function applyAgentStateUpdateAsync(
  agent: DesktopAgent,
  callback: (state: AgentState) => Promise<AgentState>
): Promise<void> {
  const internal = asInternals(agent)
  internal.state = await callback(agent.getState())
}

describe("AgentState.appDirectory ownership contract", () => {
  it("createInitialState includes empty appDirectory with apps and directoryUrls", () => {
    const state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
    const appDirectory = expectAppDirectoryOnState(state)

    expect(appDirectory.apps).toEqual([])
    expect(appDirectory.directoryUrls).toEqual([])
  })

  it("DesktopAgent seeds config.apps into state.appDirectory.apps", () => {
    const agent = new DesktopAgent({
      userChannels: DEFAULT_FDC3_USER_CHANNELS,
      apps: [mockApp1, mockApp2],
    })

    const appDirectory = expectAppDirectoryOnState(agent.getState())
    expect(appDirectory.apps).toEqual(expect.arrayContaining([mockApp1, mockApp2]))
    expect(retrieveAllApps(appDirectory)).toEqual(appDirectory.apps)
  })

  it("addApp mutator updates state.appDirectory.apps through DesktopAgent", () => {
    const agent = new DesktopAgent({ userChannels: DEFAULT_FDC3_USER_CHANNELS })

    applyAgentStateUpdate(agent, state => addApp(state, mockApp1))

    const appDirectory = expectAppDirectoryOnState(agent.getState())
    expect(appDirectory.apps).toContainEqual(mockApp1)
    expect(retrieveAppsById(appDirectory, "app-1")).toEqual([mockApp1])
  })

  it("addApplications mutator updates state.appDirectory.apps", () => {
    const agent = new DesktopAgent({ userChannels: DEFAULT_FDC3_USER_CHANNELS })

    applyAgentStateUpdate(agent, state => addApplications(state, [mockApp1, mockApp2]))

    const appDirectory = expectAppDirectoryOnState(agent.getState())
    expect(appDirectory.apps).toHaveLength(2)
    expect(appDirectory.apps.map(app => app.appId).sort()).toEqual(["app-1", "app-2"])
  })

  it("preserves addApplications duplicate appId policy on state.appDirectory.apps", () => {
    const agent = new DesktopAgent({
      userChannels: DEFAULT_FDC3_USER_CHANNELS,
      apps: [mockApp1],
    })

    applyAgentStateUpdate(agent, state => addApplications(state, [mockApp1, mockApp2]))

    const appDirectory = expectAppDirectoryOnState(agent.getState())
    expect(appDirectory.apps).toHaveLength(2)
    expect(appDirectory.apps.filter(app => app.appId === "app-1")).toHaveLength(1)
    expect(appDirectory.apps.map(app => app.appId).sort()).toEqual(["app-1", "app-2"])
  })

  it("addDirectoryUrl updates state.appDirectory.directoryUrls", () => {
    const agent = new DesktopAgent({ userChannels: DEFAULT_FDC3_USER_CHANNELS })
    const url = "https://example.com/v2/apps"

    applyAgentStateUpdate(agent, state => addDirectoryUrl(state, url))

    const appDirectory = expectAppDirectoryOnState(agent.getState())
    expect(appDirectory.directoryUrls).toEqual([url])
  })

  it("loadDirectoryIntoState updates state.appDirectory apps and directoryUrls", async () => {
    const agent = new DesktopAgent({ userChannels: DEFAULT_FDC3_USER_CHANNELS })
    const url = "https://example.com/v2/apps"
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue([mockApp1, mockApp2]),
    }

    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    await applyAgentStateUpdateAsync(agent, state => loadDirectoryIntoState(state, url))

    const appDirectory = expectAppDirectoryOnState(agent.getState())
    expect(appDirectory.apps).toHaveLength(2)
    expect(appDirectory.directoryUrls).toContain(url)
    expect(retrieveAllApps(appDirectory)).toEqual(appDirectory.apps)
  })

  it("replaceDirectoriesInState clears and reloads state.appDirectory apps and directoryUrls", async () => {
    const agent = new DesktopAgent({
      userChannels: DEFAULT_FDC3_USER_CHANNELS,
      apps: [mockApp1],
    })
    const url = "https://example.com/v2/apps"
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue([mockApp2, mockApp3]),
    }

    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    await applyAgentStateUpdateAsync(agent, state => replaceDirectoriesInState(state, [url]))

    const appDirectory = expectAppDirectoryOnState(agent.getState())
    expect(appDirectory.apps.map(app => app.appId).sort()).toEqual(["app-2", "app-3"])
    expect(appDirectory.apps.map(app => app.appId)).not.toContain("app-1")
    expect(appDirectory.directoryUrls).toEqual([url])
  })

  it("query helpers reflect state.appDirectory as the single source of truth", () => {
    const agent = new DesktopAgent({ userChannels: DEFAULT_FDC3_USER_CHANNELS })

    applyAgentStateUpdate(agent, state => addApplications(state, [mockApp1, mockApp2, mockApp3]))

    const catalog = expectAppDirectoryOnState(agent.getState())

    expect(retrieveAllApps(catalog)).toEqual(catalog.apps)
    expect(
      retrieveApps(catalog, "fdc3.contact", "ViewContact", undefined).map(app => app.appId)
    ).toEqual(["app-1", "app-3"])
  })
})
