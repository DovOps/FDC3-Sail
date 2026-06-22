---
sidebar_position: 1
---

# @finos/sail-conformance-harness

Minimal React host that wires **only** `@finos/sail-desktop-agent` to run the [FINOS FDC3 conformance toolbox](https://fdc3.finos.org/toolbox/fdc3-conformance/). Use as a diagnostic clean room compared to the full Sail stack.

**Location:** `packages/sail-conformance-harness/`

## Quick start

From the monorepo root (install dependencies there — Vite, TypeScript, and Vitest are hoisted from the root workspace):

```bash
nvm use 24
cd FDC3-Sail
npm install
npm run dev:harness
```

Dev server: **http://localhost:3001**

Equivalent: `npm run dev -w @finos/sail-conformance-harness`

```bash
npm test -w @finos/sail-conformance-harness
npm run typecheck -w @finos/sail-conformance-harness
```

## Architecture

- **`createBrowserDesktopAgent`** — local DA + WCP (no `SailPlatform`)
- **App directory** — `packages/sail-conformance-harness/conformance-appd.json` via preset `apps` option (sail-web dev merges the same fixture)
- **Intent resolution** — preset `intentResolver` with programmatic handler selection
- **Instance identity** — iframe `name` must equal `instanceId` for WCP4 correlation

## Related

- [Desktop Agent conformance traceability](../desktop-agent/conformance)
- [Integrator guide](../desktop-agent/integrator-guide)
