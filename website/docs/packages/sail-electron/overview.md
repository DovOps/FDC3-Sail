---
sidebar_position: 1
---

# @finos/sail-electron

Electron desktop wrapper for FDC3 Sail — native window chrome around the Sail web application.

**Location:** `packages/sail-electron/`

## Features

- Custom titlebar with native minimize / maximize / close
- DevTools shortcuts (`Ctrl+Shift+I`, `Ctrl+Shift+R`)
- Auto-reconnection to local dev server

## Development

From the monorepo root:

```bash
npm run dev:desktop
```

Starts `sail-server` and the Electron shell. The window loads `http://localhost:8090` by default (`SAIL_URL`). To load the full Sail web UI from `npm run dev` (port **3000**), run the browser stack in another terminal and launch Electron with `SAIL_URL=http://localhost:3000 npm run dev -w @finos/sail-electron`.

This package is optional; root `npm run build` does not include it until the Electron build is fixed.

## Related

- [Run Sail](../../run-sail) — run or host the full platform
- [Deployment targets (Electron)](../../architecture/deployment-targets)
- [@finos/sail-web](../sail-web/overview)
