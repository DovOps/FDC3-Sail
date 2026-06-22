---
sidebar_position: 4
---

# Deployment Targets: DPWA vs Electron

FDC3 Sail supports two deployment targets for the Desktop Agent: a **Desktop Progressive Web App (DPWA)** via `sail-web`, and a native desktop application via **Electron** (`sail-electron`). Both share the same `@finos/sail-desktop-agent` core.

## Overview

| Capability | DPWA (`sail-web`) | Electron (`sail-electron`) |
|---|---|---|
| **Runtime** | Modern browser (Chrome, Edge) | Chromium bundled in Electron |
| **Installation** | Installable PWA or opened in browser | Native installer / binary |
| **OS integration** | Limited (web sandbox) | Full (file system, tray, notifications) |
| **Updates** | Automatic via browser cache | Requires update mechanism |
| **Distribution** | URL / CDN | Installer package |
| **FDC3 compliance** | Full FDC3 2.2 support | Full FDC3 2.2 support |
| **App isolation** | Browser cross-origin sandboxing | Electron renderer process isolation |

## How Shared Architecture Works

Both targets use the same layered architecture:

```
┌──────────────────────────────────────────┐
│  sail-web (DPWA) │  sail-electron         │  ← Layer 3: Application
└──────────────────────────────────────────┘
                        ↓ uses
┌──────────────────────────────────────────┐
│  @finos/sail-platform-api                 │  ← Layer 2: Platform SDK
│  (transports, WCP gateway, validation)    │
└──────────────────────────────────────────┘
                        ↓ uses
┌──────────────────────────────────────────┐
│  @finos/sail-desktop-agent               │  ← Layer 1: Pure FDC3 core
│  (DACP handlers, state, WCP protocol)    │
└──────────────────────────────────────────┘
```

The `sail-desktop-agent` package is **environment-agnostic** — it has zero browser or Node.js dependencies. The transport layer is injected, so the same FDC3 logic runs identically in both deployment targets.

## DPWA (`sail-web`)

### What It Is

`sail-web` is an installable Progressive Web App that runs in a modern browser. It hosts the Desktop Agent in a browser tab/window and exposes it to FDC3 apps running in iframes via the Web Connection Protocol (WCP).

### How It Works

1. User opens the Sail URL (or launches the installed PWA).
2. The Sail UI loads in the browser.
3. FDC3 apps open in iframes within the Sail window.
4. Apps connect to the Desktop Agent via `window.postMessage` (WCP1–3 handshake).
5. After handshake, apps communicate via a dedicated `MessagePort` (WCP4–5).

### Advantages

- **Zero installation for the DA**: Users access the Desktop Agent via a URL — no binary to install.
- **Automatic updates**: The DA updates on every page load without user action.
- **Cross-platform**: Runs wherever Chrome/Edge runs (Windows, macOS, Linux).
- **Developer-friendly**: Standard web debugging tools work out of the box.
- **No Electron maintenance**: No need to track Electron security releases.

### Limitations

- **Sandboxed**: Limited access to OS-level APIs (file system, system tray, OS notifications).
- **Browser restrictions**: Apps must be served over HTTPS in production. Cross-origin restrictions apply.
- **Single window**: All FDC3 apps share the Sail browser window (iframes), limiting independent window management.
- **No native packaging**: Cannot be distributed as a standalone `.exe` or `.dmg` without a wrapper.

### When to Choose DPWA

- You want the simplest possible deployment with no installation step.
- Your FDC3 apps are web-based and don't need deep OS integration.
- You prioritise ease of update and maintenance.
- You're building a SaaS or cloud-hosted desktop agent.

## Electron (`sail-electron`)

### What It Is

`sail-electron` packages the Desktop Agent as a native desktop application using Electron. It runs a Chromium-based browser internally but presents itself as a native `.app` / `.exe` to the operating system.

### How It Works

1. User installs and launches the Electron application.
2. The main process hosts the Desktop Agent logic.
3. FDC3 apps open as Electron `BrowserWindow` instances (rather than iframes).
4. Apps connect to the Desktop Agent via Electron's IPC bridge (the preload script exposes the WCP interface to renderer processes).
5. After connection, apps use `MessagePort` for efficient communication.

### Advantages

- **Native OS integration**: System tray, notifications, file system access, and native menus.
- **Independent windows**: FDC3 apps run as separate OS windows, not iframes — enabling a true multi-window desktop layout.
- **Packaging**: Distributable as a signed native installer for corporate IT deployment.
- **No browser tab management**: The DA doesn't compete with the user's browser tabs.
- **Offline-capable**: Can be bundled with all dependencies for air-gapped environments.

### Limitations

- **Installation required**: Users must install the binary; IT may require admin rights.
- **Update management**: Updates require an in-app updater (e.g., `electron-updater`) or manual re-install.
- **Binary size**: Electron bundles Chromium (~100–200 MB).
- **Security maintenance**: Must track Electron security releases and rebuild regularly.
- **Platform-specific builds**: Separate binaries for Windows, macOS, and Linux.

### When to Choose Electron

- Your users need OS-level features (system tray icon, native notifications, deep links).
- You need independent window management per FDC3 app.
- Your organisation requires a packaged, IT-managed desktop application.
- You need to operate in an air-gapped or restricted network environment.

## The Decision: Support Both

FDC3 Sail supports both targets because different organisations have different requirements. The shared `sail-desktop-agent` core ensures FDC3 conformance is identical regardless of deployment target. New FDC3 features and bug fixes flow to both targets simultaneously.

The `sail-platform-api` package abstracts the transport layer, making it straightforward to add additional deployment targets (e.g., a Node.js server-side Desktop Agent for testing, or a WebSocket-based cloud bridge).

## Related Documentation

- [Architecture Overview](./overview) - Three-layer architecture
- [@finos/sail-desktop-agent](../packages/desktop-agent/overview) - Core FDC3 engine
- [@finos/sail-platform-api](../packages/platform-api/overview) - Platform services
