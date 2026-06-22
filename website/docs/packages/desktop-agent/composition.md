---
sidebar_position: 3
title: Composition & internals
---

# Composition & internals

How `@finos/sail-desktop-agent` modules compose and interact. For integration steps and copy-paste examples, see the [integrator guide](./integrator-guide).

## Layered runtime model

```mermaid
flowchart TB
  subgraph apps ["FDC3 apps (external)"]
    A1["iframe app — @finos/fdc3"]
    A2["iframe app — @finos/fdc3"]
  end

  subgraph host ["Your host shell"]
    HL["AppLauncher"]
    HI["intentResolver"]
    HC["channels"]
    HA["apps"]
  end

  subgraph edge ["App connection — app-connection/"]
    WCP["WCPConnector"]
    MP1["MessagePortTransport"]
    MP2["MessagePortTransport"]
    WCP --> MP1
    WCP --> MP2
  end

  subgraph wire ["Internal transport (local mode)"]
    T["InMemoryTransport pair"]
  end

  subgraph da ["Desktop Agent — core/"]
    DAG["DesktopAgent"]
    H["DACP handlers"]
    S["AgentState"]
    DAG --> H --> S
  end

  A1 <-->|"WCP + MessagePort"| MP1
  A2 <-->|"WCP + MessagePort"| MP2
  host -->|"host contracts"| edge
  HL -.->|"iframe name = instanceId"| A1
  edge <-->|"one Transport pipe"| T
  T <--> da
```

**Key rule:** apps never talk to `DesktopAgent` directly. All app traffic flows **edge → Transport → DA → Transport → edge → MessagePort**.

## Preset vs manual composition

```mermaid
flowchart LR
  subgraph preset ["Preset — 90% of hosts"]
    P["createBrowserDesktopAgent()"]
    P --> E1["WCPConnector (hidden)"]
    P --> D1["DesktopAgent"]
    E1 --- T1["InMemoryTransport pair"]
    D1 --- T1
  end

  subgraph manual ["Manual — framework authors"]
    D2["new DesktopAgent({ transport })"]
    E2["new WCPConnector(transport)"]
    D2 --- T2["createInMemoryTransportPair()"]
    E2 --- T2
  end

  subgraph remote ["Remote DA"]
    C["createWCPClient({ transport })"]
    S["new DesktopAgent on server"]
    C --- NET["Socket / Worker transport"]
    S --- NET
  end
```

| Pattern | Returns | You manage |
|---------|---------|------------|
| `createBrowserDesktopAgent` | `DesktopAgent` + `intentResolver`, `channels`, `apps` | `AppLauncher`; wire host UI via controllers |
| `createBrowserHostControllers` | `{ intentResolver, channels, apps }` | Manual `DesktopAgent` + `WCPConnector` composition |
| `getBrowserDesktopAgentSession(da)` | `{ wcpConnector, connectorTransport }` | Advanced edge tests |
| `createWCPClient` | `{ wcpConnector, start, stop }` | Browser side of remote DA |
| Manual pair | `DesktopAgent` + `WCPConnector` | Both transports and lifecycle |

## Source tree responsibilities

```text
packages/sail-desktop-agent/src/
│
├── core/
│   ├── desktop-agent.ts       # DesktopAgent class — start/stop, handler dispatch
│   ├── dacp/                  # DACP message types and helpers
│   ├── handlers/dacp/         # All FDC3 operations (open, channels, intents, …)
│   ├── handlers/dacp/wcp-handlers.ts  # WCP4–5 identity validation
│   ├── state/                 # Immutable AgentState (selectors + mutators)
│   └── app-directory/         # DirectoryApp metadata
│
├── host-contracts/
│   ├── app-launcher.ts        # AppLauncher — host opens iframes/windows
│   ├── intent-resolver.ts     # IntentResolver — disambiguation UI contract
│   └── channel-control.ts     # ChannelControl — picker contract shape
│
├── app-connection/
│   ├── wcp/                   # WCP handshake, routing, connection map
│   ├── wcp-connector.ts       # WCP1–3, postMessage listener, port map
│   └── message-port-transport.ts
│
├── presets/
│   ├── create-browser-desktop-agent.ts  # createBrowserDesktopAgent (local DA + edge)
│   ├── create-wcp-client.ts             # createWCPClient (remote DA mode)
│   └── browser-session.ts               # createBrowserHostControllers, getBrowserDesktopAgentSession
│
└── transports/
    └── in-memory-transport.ts # Same-process linked endpoints
```

## WCP and DACP ownership

```mermaid
sequenceDiagram
  participant App as App iframe
  participant Edge as WCPConnector
  participant Tr as Transport
  participant DA as DesktopAgent

  Note over App,Edge: WCP1–3 — edge only
  App->>Edge: WCP1Hello (postMessage)
  Edge->>App: WCP3Handshake + MessagePort

  Note over App,DA: WCP4–5 — DA validates, edge migrates port map
  App->>Edge: WCP4 on MessagePort
  Edge->>Tr: forward WCP4
  Tr->>DA: WCP4ValidateAppIdentity
  DA->>Tr: WCP5 response
  Tr->>Edge: WCP5
  Edge->>App: WCP5 on MessagePort
  Edge->>Edge: temp id → canonical id

  Note over App,DA: DACP — DA handlers, edge routes by instanceId
  App->>Edge: joinUserChannelRequest
  Edge->>Tr: DACP + meta.source
  Tr->>DA: handler updates state
  DA->>Tr: channelChangedEvent + meta.destination
  Tr->>Edge: route to port
  Edge->>App: deliver on MessagePort
```

| Phase | Owner | Code location |
|-------|--------|---------------|
| WCP1–3 | Edge | `app-connection/wcp-connector.ts`, `app-connection/wcp/wcp1-3-handshake.ts` |
| MessagePort bridge | Edge | `app-connection/message-port-transport.ts`, `app-connection/wcp/wcp-message-routing.ts` |
| WCP4–5 | DA (+ edge port migration) | `core/handlers/dacp/wcp-handlers.ts` |
| WCP6 Goodbye | Both | Edge drops port; DA removes instance |
| DACP (all `fdc3.*`) | DA | `core/handlers/dacp/*` |

## Instance identity pipeline

Toolbox `AppTimeout` usually means a break in this chain:

```mermaid
flowchart LR
  L["AppLauncher.instanceId"]
  I["iframe name"]
  T["temp-{uuid} on edge"]
  W4["WCP4 claim"]
  C["canonical instanceId"]
  R["meta.destination.instanceId"]

  L --> I --> T --> W4 --> C --> R
```

| Step | Module |
|------|--------|
| Launcher returns id | `host-contracts/app-launcher.ts` |
| Open registers PENDING | `core/handlers/dacp/app-handlers.ts` |
| WCP4 adopt vs mint | `core/handlers/dacp/wcp-handlers.ts` |
| Port map migration | `app-connection/wcp/wcp-connection-management.ts` |

## Intent resolution flow

```mermaid
sequenceDiagram
  participant App as Raising app
  participant DA as DesktopAgent
  participant Edge as WCPConnector
  participant Host as Host IntentResolver

  App->>DA: raiseIntentRequest
  DA->>DA: multiple handlers — pause
  DA->>Edge: intentResolverNeeded
  Edge->>Host: event (or preset calls IntentResolver.resolve)
  Host->>Host: show picker UI
  Host->>Edge: resolveIntentSelection
  Edge->>DA: selection
  DA->>App: intent delivered to target
```

Two mechanisms exist for intent UI — see [integrator guide — intent resolver](./integrator-guide#intent-resolver--host-shell-ui):

- **Host shell (default):** `intentResolver` controller (canonical; `intentResolverUI` transitional alias) or low-level `IntentResolver` contract
- **WCP3 injection:** `wcpOptions.intentResolverUrl` — `@finos/fdc3` loads iframe in app window

## Channel change flow (host chrome)

```mermaid
sequenceDiagram
  participant Chrome as Host channel toolbar
  participant Ctrl as channels controller
  participant Edge as WCPConnector
  participant DA as DesktopAgent
  participant App as App iframe

  Chrome->>Ctrl: changeAppChannel(instanceId, channelId)
  Ctrl->>DA: changeAppUserChannel
  DA->>DA: update instance.currentUserChannel
  DA->>Edge: channelChangedEvent
  Edge->>App: userChannelChanged
  Edge->>Ctrl: channelChanged event
  Ctrl->>Chrome: onAppChannelChange callback
```

Browser preset hosts use **`channels.changeAppChannel`** and **`channels.onAppChannelChange`**. `SailPlatform` wraps the same engine path for the reference stack — see [integrator guide](./integrator-guide#channel-selector--host-shell-ui).

Manual composition without the preset factory: build controllers with **`createBrowserHostControllers({ desktopAgent, wcpConnector, connectorTransport })`** from `@finos/sail-desktop-agent/presets`.

## Testing layers

| Layer | Suite | Proves |
|-------|-------|--------|
| DACP handlers | Cucumber + MockTransport (~103 `@conformance2.2`) | FDC3 handler behaviour |
| Handler units | Vitest in `dacp/__tests__/` | Individual request paths |
| Edge seam | `wcp-desktop-agent.integration.test.ts` | WCP + MessagePort + DA routing |
| Full oracle | FINOS toolbox via conformance harness | End-to-end browser behaviour |

See [conformance traceability](./conformance) for BDD vs toolbox gaps.

## Related

- [Integrator guide](./integrator-guide) — host contracts, presets, deployment decision tree
- [Channel selection (Sail stack)](../../architecture/channel-selection) — `SailPlatform` channel APIs
- [@finos/sail-platform-api](../platform-api/overview) — workspace, layout, `SailPlatform` wrapper
