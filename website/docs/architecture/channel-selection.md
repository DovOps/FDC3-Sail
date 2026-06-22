---
sidebar_position: 4
---

# Channel selection: host chrome vs app-hosted UI

FDC3 user channels can be changed in two ways. Sail supports both at the protocol level; **Sail Web uses host-controlled chrome** by default.

For **one agent per browsing context** and why host chrome must not poll `getState()`, see [Integrator guide — One Desktop Agent per context](../packages/desktop-agent/integrator-guide.md#one-desktop-agent-per-context).

## Roles

| Layer | Responsibility |
|-------|----------------|
| **`@finos/sail-desktop-agent`** | FDC3 engine: DACP handlers, agent state, WCP routing, events to apps. Stays **protocol-pure** — no Sail UI, no “chrome” concepts. |
| **`@finos/sail-platform-api`** | Host integration: `SailPlatform`, lifecycle, **channel APIs for parent UI**, WCP connector events, optional `ChannelSelector` callback. |
| **`@finos/sail-web`** (example host) | React chrome (`ChannelSelector`), connection store, tiles around iframes. |

**Principle:** Parent chrome does not mutate Desktop Agent state directly. It calls **platform APIs**; the agent updates state through the same DACP handlers apps use.

## Pattern A — Host-controlled channel UI (Sail default)

**When:** `getChannelSelectorUrl()` returns `false` in WCP3 handshake (Sail-controlled UI).

**Where the UI lives:** Parent window chrome next to each app iframe (one desk, consistent UX).

**Layout:**

```text
┌──────────────────────────────────────────────────────────┐
│  Host (sail-web) — tabs, channel dots, workspace chrome   │
│  ┌────────────────────────────────────────────────────┐  │
│  │  App iframe — FDC3 API + business UI only           │  │
│  │  MessagePort ◄──► WCPConnector ◄──► Desktop Agent    │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Set (join / leave) on behalf of an instance

**Browser preset** hosts call **`channels.changeAppChannel(instanceId, channelId | null)`** on the `createBrowserDesktopAgent` handle.

**Sail platform** hosts call **`SailPlatform.changeAppChannel(instanceId, channelId | null)`**.

Both paths:

1. Send a typed **`joinUserChannelRequest`** or **`leaveCurrentChannelRequest`** with `meta.source.instanceId` set to that app.
2. Desktop Agent handlers update `instance.currentUserChannel`.
3. Agent emits **`channelChangedEvent`** toward the app.
4. WCP routes the event and emits **`channelChanged`** on the connector; the `channels` controller surfaces this via **`onAppChannelChange`**.

This is “on behalf of the app” in **identity** (source instance id), not “bypass FDC3”.

### Get (read) for chrome

| What chrome needs | Browser preset API | SailPlatform API | Notes |
|-------------------|-------------------|------------------|--------|
| List of user channels | `channels.getUserChannels()` | `platform.getUserChannels()` | Reads agent state (not per-app DACP). |
| Current channel for a tile | `channels.getAppChannelId(instanceId)` or `channels.getAppChannel(instanceId)` | `platform.getAppUserChannel(instanceId)` | No DACP round-trip. |
| Event-driven mirror | `channels.onAppChannelChange(listener)` | `onChannelChanged` → connection store | Push model — do not poll `getState()`. |

Apps still use **`fdc3.getCurrentChannel()`** inside the iframe over MessagePort — that is the app’s own DACP `getCurrentChannelRequest`.

### Listen for updates

| Consumer | Listen to |
|----------|-----------|
| **Host chrome (preset)** | `channels.onAppChannelChange` on the `createBrowserDesktopAgent` handle |
| **Host chrome (Sail platform)** | `SailPlatform` config `onChannelChanged`, or `wcpConnector.on("channelChanged")`, or a store fed by those events |
| **App iframe** | `fdc3.addEventListener("userChannelChanged", …)` (FDC3 2.2) |

Both reflect the same agent state change; the host does not need to poke the iframe DOM.

## Pattern B — App-hosted channel selector URL

**When:** `getChannelSelectorUrl(instanceId)` returns a URL (or the app shows its own picker).

**Where the UI lives:** URL loaded in app context (iframe/popup) per FDC3 For-the-Web.

**Flow:**

1. App or selector page sends **`joinUserChannelRequest` / `leaveCurrentChannelRequest`** over the app **MessagePort**.
2. Messages pass **`bridgeTransports`** validation (`isAppMessage`).
3. Same agent handlers and **`channelChangedEvent`** as Pattern A.

**Host chrome** may still listen to `channelChanged` for a global indicator, but it does **not** initiate joins.

## What not to do

- **Raw DACP impersonation** (`sendDACPMessageOnBehalfOf`, private `handleMessage`) — bypasses WCP validation; use typed **`channels.changeAppChannel`** on the browser preset or **`SailPlatform.changeAppChannel`** instead.
- **Chrome writing agent state without DACP handlers** — breaks conformance and app event delivery.

## Platform and preset API surface

```typescript
// Browser preset — createBrowserDesktopAgent handle
const { channels } = desktopAgent
await channels.changeAppChannel(instanceId, "fdc3.channel.1")
await channels.changeAppChannel(instanceId, null) // leave
const channelList = channels.getUserChannels()
const channelId = channels.getAppChannelId(instanceId)
channels.onAppChannelChange(({ instanceId, channelId }) => { ... })

// Sail platform — reference stack wrapper
await platform.changeAppChannel(instanceId, "fdc3.channel.1")
await platform.changeAppChannel(instanceId, null)
const platformChannels = platform.getUserChannels()
const platformChannelId = platform.getAppUserChannel(instanceId)
platform.start({ onChannelChanged: (instanceId, channelId) => { ... } })
```

Embedders using **`createBrowserDesktopAgent`** directly should use **`channels.*`**, not raw `connectorTransport.send` or `getAppUserChannelId` alone. **`SailPlatform`** remains the reference stack for workspace and layout.

## Related work

- Integrator singleton + channel reactivity: [Desktop Agent integrator guide](../packages/desktop-agent/integrator-guide.md#one-desktop-agent-per-context)
- Transport hardening: `plans/work-items/replace-dacp-impersonation-with-channel-api.md`
- Architecture overview: [Overview](./overview.md) (Sail-controlled UI)
- Platform API: [@finos/sail-platform-api](../packages/platform-api/overview)
