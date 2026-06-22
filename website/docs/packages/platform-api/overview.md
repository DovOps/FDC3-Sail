---
sidebar_position: 1
---

# @finos/sail-platform-api

Platform SDK for FDC3 Sail. Wraps `@finos/sail-desktop-agent` with Sail-specific middleware, workspace/layout/config persistence, and host integration helpers.

**Location:** `packages/sail-platform-api/`

## Boundary

| Concern | Owner |
|---------|--------|
| FDC3 engine, WCP, DACP, presets | [`@finos/sail-desktop-agent`](../desktop-agent/overview) |
| **Layout**, **workspace**, **storage**, **config** | `@finos/sail-platform-api` |
| React workspace UI | [`@finos/sail-web`](../sail-web/overview) |

## Stack position

```text
sail-web (React UI)
        │
        ▼
@finos/sail-platform-api          ← this package
  - SailPlatform
  - createSailBrowserDesktopAgent
  - SailAppLauncher
  - MiddlewarePipeline
        │
        ▼
@finos/sail-desktop-agent         ← pure FDC3 core
  - DesktopAgent
  - createBrowserDesktopAgent
```

## SailPlatform (recommended)

Primary entry point for a full Sail host:

```typescript
import { SailPlatform } from "@finos/sail-platform-api"

const platform = new SailPlatform({
  appLauncher: myAppLauncher,
  intentResolver: myIntentResolver, // optional
  onAppConnected: meta => console.log(meta.appId),
  onChannelChanged: (instanceId, channelId) => updateChrome(instanceId, channelId),
})

platform.start()

// Channel chrome — typed join/leave, no DACP impersonation
await platform.changeAppChannel(instanceId, "fdc3.channel.1")
const channelId = platform.getAppUserChannel(instanceId)

// Platform features
await platform.workspaces.list()
await platform.layouts.save(workspaceId, layout)

platform.stop()
```

`SailPlatform` delegates engine wiring to `createBrowserDesktopAgent` from sail-desktop-agent. Access the edge via `platform.connector` when needed.

See [Channel selection](../../architecture/channel-selection) for host chrome vs app-hosted selector URLs.

## createSailBrowserDesktopAgent (advanced)

Lower-level browser wrapper with Sail WCP defaults and optional origin allowlist:

```typescript
import { createSailBrowserDesktopAgent } from "@finos/sail-platform-api"

const desktopAgent = createSailBrowserDesktopAgent({
  appLauncher: myLauncher,
  appDirectories: ["/apps.json"],
  allowedOrigins: ["https://my-host.example"], // optional Sail policy
  debug: true,
})

// Returns DesktopAgent — edge starts with desktopAgent.start()
desktopAgent.start()
```

Does **not** include workspace/layout APIs or `SailPlatform` event wiring. Prefer `SailPlatform` for production hosts.

## Middleware and validation

- **`MiddlewarePipeline`** — intercept DACP messages before the Desktop Agent
- **`validateDACPMessage` / `safeParseDACPMessage`** — Zod-based DACP validation

## Re-exports

For convenience, commonly used sail-desktop-agent symbols are re-exported:

```typescript
import {
  DesktopAgent,
  createBrowserDesktopAgent,
  WCPConnector,
} from "@finos/sail-platform-api"
```

## Related

- [Desktop Agent integrator guide](../desktop-agent/integrator-guide)
- [Architecture overview](../../architecture/overview)
- [Channel selection](../../architecture/channel-selection)
