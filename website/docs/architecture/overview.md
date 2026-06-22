---
sidebar_position: 1
---

# Architecture Overview

FDC3 Sail implements the FDC3 2.2 standard with a small set of package boundaries: a reusable Desktop Agent engine, optional Sail platform services, and host applications that provide the user experience.

This page is the system map. Package APIs, source-tree diagrams, and integration examples live under [Packages](../packages/desktop-agent/overview).

## Core Principles

### 1. FDC3 compliance first

- FDC3 apps use the standard `@finos/fdc3` library.
- App-to-agent communication follows FDC3 For-the-Web: WCP for discovery and connection, DACP for Desktop Agent operations.
- Sail-specific workspace, layout, config, and product-shell behavior stays outside the FDC3 engine.

### 2. Clear package ownership

- **`@finos/sail-desktop-agent`** owns FDC3 behavior: `DesktopAgent`, DACP handlers, WCP protocol helpers, browser connectors, transports, host contracts, and presets.
- **`@finos/sail-platform-api`** owns Sail platform features: `SailPlatform`, workspace/layout/config APIs, product middleware, and host integration helpers.
- **`@finos/sail-web`** and **`@finos/sail-electron`** are deployment hosts that provide UI, app launch surfaces, and packaging.

### 3. Composition over hidden globals

Sail does not rely on a host-page `window.fdc3` preload. FDC3 apps run in iframe or window browsing contexts and discover the Desktop Agent through WCP. Host UI talks to `SailPlatform` or `DesktopAgent` APIs directly.

### 4. Deployment target independence

The same Desktop Agent core can be used in browser, worker, server, and Electron-style deployments. Runtime-specific pieces are connected through transports and host contracts.

## Layered Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│  Hosts                                                      │
│  @finos/sail-web, @finos/sail-electron, custom host shells  │
│  - workspace UI, app launch surfaces, channel chrome        │
│  - intent resolver UI, packaging, product experience        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Sail platform services                                     │
│  @finos/sail-platform-api                                   │
│  - SailPlatform                                             │
│  - workspace, layout, config, storage-facing APIs           │
│  - Sail policy and host integration helpers                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  FDC3 Desktop Agent engine                                  │
│  @finos/sail-desktop-agent                                  │
│  - DesktopAgent, DACP handlers, AgentState                  │
│  - WCP protocol helpers and browser connectors              │
│  - transports, host contracts, presets                      │
└─────────────────────────────────────────────────────────────┘
```

## App Connection Model

FDC3 apps connect through WCP and then exchange DACP messages over a per-app transport:

```text
FDC3 app iframe/window
        │  WCP discovery + MessagePort
        ▼
Browser edge connector
        │  Transport
        ▼
DesktopAgent
```

For the detailed connection flow, module ownership, and manual composition patterns, see [Composition & internals](../packages/desktop-agent/composition) and the [Desktop Agent integrator guide](../packages/desktop-agent/integrator-guide).

## Host-Controlled UI

Sail Web uses host-controlled UI for shared desktop affordances:

- The host renders channel chrome around app iframes.
- The host supplies intent resolution UI.
- Apps still receive standard FDC3 events and call standard FDC3 APIs.

See [Channel selection](./channel-selection) for the boundary between host chrome, `SailPlatform`, and app-hosted selector URLs.

## Learn More

- [Deployment targets](./deployment-targets) — DPWA/browser vs Electron packaging trade-offs.
- [Channel selection](./channel-selection) — host chrome vs app-hosted channel selector flows.
- [@finos/sail-desktop-agent](../packages/desktop-agent/overview) — FDC3 engine, integrator guide, and composition diagrams.
- [@finos/sail-platform-api](../packages/platform-api/overview) — Sail platform services and host integration APIs.
