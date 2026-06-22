import { describe, expect, it } from "vite-plus/test"
import type { BrowserTypes } from "@finos/fdc3"
import { MockTransport } from "../../__tests__/utils/mock-transport"
import { DesktopAgent } from "../desktop-agent"
import { connectInstance, updateInstanceState } from "../state/mutators"
import { getAllUserChannels } from "../state/selectors"
import type { AgentState } from "../state/types"
import { AppInstanceState } from "../state/types"
import { createDacpRequestMeta } from "../handlers/dacp/__tests__/test-context"

type Channel = BrowserTypes.Channel

const CONFIGURED_USER_CHANNELS: Channel[] = [
  {
    id: "config.channel.1",
    type: "user",
    displayMetadata: {
      name: "Config Channel 1",
      color: "#111111",
    },
  },
  {
    id: "config.channel.2",
    type: "user",
    displayMetadata: {
      name: "Config Channel 2",
      color: "#222222",
    },
  },
]

const RUNTIME_USER_CHANNELS: Record<string, Channel> = {
  "runtime.channel.1": {
    id: "runtime.channel.1",
    type: "user",
    displayMetadata: {
      name: "Runtime Channel",
      color: "#ABCDEF",
    },
  },
}

function sortChannelsById(channels: Channel[]): Channel[] {
  return [...channels].sort((left, right) => left.id.localeCompare(right.id))
}

type DesktopAgentInternals = {
  state: AgentState
}

function asInternals(agent: DesktopAgent): DesktopAgentInternals {
  return agent as DesktopAgent & DesktopAgentInternals
}

/** Same pattern as Cucumber `applyDesktopAgentStateUpdate` — mutates agent state like DACP setState. */
function applyAgentStateUpdate(
  agent: DesktopAgent,
  callback: (state: AgentState) => AgentState
): void {
  const internal = asInternals(agent)
  internal.state = callback(agent.getState())
}

function seedConnectedInstance(state: AgentState, instanceId: string, appId: string): AgentState {
  const next = connectInstance(state, {
    instanceId,
    appId,
    metadata: { appId, name: appId },
  })
  return updateInstanceState(next, instanceId, AppInstanceState.CONNECTED)
}

describe("DesktopAgent user channel state", () => {
  it("seeds state.channels.user from constructor config at initialization", () => {
    const agent = new DesktopAgent({ userChannels: CONFIGURED_USER_CHANNELS })

    const stateChannels = getAllUserChannels(agent.getState())

    expect(Object.keys(agent.getState().channels.user)).toEqual([
      "config.channel.1",
      "config.channel.2",
    ])
    expect(sortChannelsById(stateChannels)).toEqual(sortChannelsById(CONFIGURED_USER_CHANNELS))
  })

  it("getUserChannels returns channels from agent state not constructor config copy", () => {
    const agent = new DesktopAgent({ userChannels: CONFIGURED_USER_CHANNELS })

    applyAgentStateUpdate(agent, state => ({
      ...state,
      channels: {
        ...state.channels,
        user: RUNTIME_USER_CHANNELS,
      },
    }))

    const expectedFromState = getAllUserChannels(agent.getState())

    expect(sortChannelsById(agent.getUserChannels())).toEqual(sortChannelsById(expectedFromState))
  })

  it("host getUserChannels stays aligned with DACP getUserChannelsResponse", async () => {
    const transport = new MockTransport()
    const agent = new DesktopAgent({
      transport,
      userChannels: CONFIGURED_USER_CHANNELS,
    })
    agent.start()

    applyAgentStateUpdate(agent, state =>
      seedConnectedInstance(
        {
          ...state,
          channels: {
            ...state.channels,
            user: RUNTIME_USER_CHANNELS,
          },
        },
        "a1",
        "App1"
      )
    )

    await transport.receiveMessage({
      type: "getUserChannelsRequest",
      payload: {},
      meta: createDacpRequestMeta("get-user-channels-state-source", {
        appId: "App1",
        instanceId: "a1",
      }),
    })

    const response = transport.getLastMessage() as {
      type: string
      payload: { userChannels: Channel[] }
    }

    expect(response.type).toBe("getUserChannelsResponse")
    expect(sortChannelsById(agent.getUserChannels())).toEqual(
      sortChannelsById(response.payload.userChannels)
    )
  })
})
