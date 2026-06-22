# @finos/sail-conformance-harness

Minimal React host for the [FINOS FDC3 conformance toolbox](https://fdc3.finos.org/toolbox/fdc3-conformance/) — wires only `@finos/sail-desktop-agent` (no full Sail stack).

## Documentation

[finos.github.io/FDC3-Sail/docs/packages/conformance-harness/overview](https://finos.github.io/FDC3-Sail/docs/packages/conformance-harness/overview)

## Fixtures and toolbox results

| Path | Purpose |
|------|---------|
| `conformance-appd.json` | FINOS conformance app directory (shared with `sail-web` dev) |
| `results/conformance-report-v3.txt` … `v5.txt` | Committed FINOS toolbox export history ( **v5 = current baseline** ) |
| `results/conformance-test-failure-review.md` | Failure attribution matrix vs exports |
| `results/README.md` | This folder index |

## Run

From the monorepo root (`npm install` at repo root — shared dev tooling is hoisted from the root workspace):

```bash
npm run dev -w @finos/sail-conformance-harness
```

Dev server: **http://localhost:3001**

## Session teardown

Launched mock apps (popups) are **pre-registered** with the desktop agent before `window.open` so WCP4 adopts the host `instanceId`. When a popup closes or sends WCP6 goodbye, the harness calls `disconnectInstance` and removes the panel entry so later toolbox scenarios (channels, `findIntent`) do not accumulate stale instances. Popup `window.closed` is polled every **100ms** (no `window.close` override on child windows).

```bash
npm test -w @finos/sail-conformance-harness
npm run typecheck -w @finos/sail-conformance-harness
```
