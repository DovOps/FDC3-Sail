# @finos/sail-desktop-agent

Pure, transport-agnostic [FDC3 2.2](https://fdc3.finos.org/docs/api/spec) Desktop Agent — DACP handlers, channels, intents, app directory, and browser WCP support. Runs in browser, Node.js, Web Workers, or any JavaScript runtime.

Platform concerns (layout, workspace, storage, Sail config) belong in [`@finos/sail-platform-api`](../sail-platform-api/README.md), not in this package.

## Documentation

Full documentation lives on the **FDC3 Sail docs site** (single source of truth):

| Topic | Link |
|-------|------|
| Overview & quick start | [finos.github.io/FDC3-Sail/docs/packages/desktop-agent/overview](https://finos.github.io/FDC3-Sail/docs/packages/desktop-agent/overview) |
| **Integrator guide** (start here) | [finos.github.io/FDC3-Sail/docs/packages/desktop-agent/integrator-guide](https://finos.github.io/FDC3-Sail/docs/packages/desktop-agent/integrator-guide) |
| Composition & diagrams | [finos.github.io/FDC3-Sail/docs/packages/desktop-agent/composition](https://finos.github.io/FDC3-Sail/docs/packages/desktop-agent/composition) |
| Conformance traceability | [finos.github.io/FDC3-Sail/docs/packages/desktop-agent/conformance](https://finos.github.io/FDC3-Sail/docs/packages/desktop-agent/conformance) |

## Install

```bash
npm install @finos/sail-desktop-agent
```

## Minimal example

```typescript
import { createBrowserDesktopAgent } from "@finos/sail-desktop-agent/presets"
import type { AppLauncher } from "@finos/sail-desktop-agent"

const desktopAgent = createBrowserDesktopAgent({
  appDirectories: ["/apps.json"],
  appLauncher: myAppLauncher,
})
// Auto-started — iframe apps can await fdc3.getAgent()
```

See the [integrator guide](https://finos.github.io/FDC3-Sail/docs/packages/desktop-agent/integrator-guide) for host contracts, intent resolution, channel chrome, and remote DA deployment.

## License

Copyright 2025 FINOS. Distributed under the Apache 2.0 License.
