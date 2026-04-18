# fdc3-web Migration Notes for Sail

## Goal

Evaluate whether demo-path Sail apps can use [`@morgan-stanley/fdc3-web`](https://github.com/morganstanley/fdc3-web) for a cleaner browser-side integration model than direct usage of legacy `@robmoffat/*` client bindings.

## Evidence Summary

### What fdc3-web provides

Primary-source documentation indicates that `fdc3-web` includes:

- a root/proxy desktop-agent model,
- built-in FDC3 Web Connection Protocol (WCP) support,
- `getAgent()` discovery + failover strategy,
- explicit app-directory integration,
- adjustable logging levels,
- optional resolver/channel-selector UI providers.

References:

- `fdc3-web` README: <https://github.com/morganstanley/fdc3-web>
- `fdc3-web` architecture doc: <https://github.com/morganstanley/fdc3-web/blob/main/ARCHITECTURE.md>
- FDC3 spec portal: <https://fdc3.finos.org/docs/spec>
- FDC3 WCP docs: <https://fdc3.finos.org/docs/spec/latest/wcp/>

### What we observed in Sail

Sail currently uses `@finos/fdc3` internally for DA/runtime packages, while many example apps still import `@robmoffat/fdc3` / `@robmoffat/fdc3-get-agent`.

In practical demo use, some widgets tend to rely on fragile listener timing patterns (for example, delayed listener setup and state-coupled re-registration loops), which can make behavior noisy or flaky.

## Migration Scope Implemented in This Branch

This branch migrates Sail demo app FDC3 agent acquisition to `@morgan-stanley/fdc3-web`:

- `packages/fdc3-example-apps/front-end-apps/tradingview/src/TradingViewWidget.tsx`
- `packages/fdc3-example-apps/server-apps/polygon/src/PolygonWidget.tsx`
- `packages/fdc3-example-apps/front-end-apps/tradelist/src/main.ts`
- `packages/fdc3-example-apps/front-end-apps/benzinga-news/src/Widget.tsx`
- `packages/fdc3-example-apps/front-end-apps/broadcast/src/main.tsx`
- `packages/fdc3-example-apps/front-end-apps/intent-listener-1/src/app5.ts`
- `packages/fdc3-example-apps/front-end-apps/intent-listener-3/src/app4.ts`
- `packages/fdc3-example-apps/front-end-apps/intent-raise-1/src/app6.ts`
- `packages/fdc3-example-apps/front-end-apps/intent-raise-2/src/app7.ts`
- `packages/fdc3-example-apps/front-end-apps/pricer/src/main.ts`
- `packages/fdc3-example-apps/front-end-apps/receive/src/main.tsx`
- `packages/fdc3-example-apps/server-apps/encrypted-channel-sender/src/index.tsx`
- `packages/fdc3-example-apps/server-apps/encrypted-channel-receiver/src/index.tsx`
- `packages/fdc3-example-apps/server-apps/signed-sender/src/index.tsx`
- `packages/fdc3-example-apps/server-apps/signed-receiver/src/index.tsx`
- `packages/fdc3-example-apps/common/src/security-demo/fdc3.ts`
- `packages/fdc3-example-apps/package.json`
- `packages/electron/src/preload/DesktopAgentProxy.ts`
- `packages/electron/package.json`

### Changes made

1. Migrated demo app `getAgent()` imports to `@morgan-stanley/fdc3-web`.
2. Migrated Electron preload proxy `getAgent()` to `@morgan-stanley/fdc3-web`.
3. Aligned non-security demo app type imports to `@finos/fdc3`.
4. Kept security-demo type compatibility (`@robmoffat/fdc3` types) but switched their runtime `getAgent` calls to `fdc3-web` using explicit compatibility casts.
5. Added `@morgan-stanley/fdc3-web` dependency to Electron and aligned Electron `@finos/fdc3` to stable `^2.2.0` to satisfy peer constraints.
6. Aligned Sail core packages to stable `@finos/fdc3` (`packages/common`, `packages/da-impl`, `packages/web`) instead of beta-only pins.
7. Refactored TradingView/Polygon listener setup to a single lifecycle registration model (no state-driven re-registration loop).
8. Added wildcard context listeners for `fdc3.instrument` parity handling.
9. Added channel-context sync polling for resilience in demo scenarios.

### TradingView optional context-driven symbol updates

TradingView now supports optional channel-context sync for `fdc3.instrument` updates.

- Query param: `listenChannelContext`
- Default: enabled
- Disable via URL: `?listenChannelContext=false`

This is intended to improve symbol refresh behavior when context listener delivery timing is inconsistent in browser demo setups.

## Why this is cleaner (for demo apps)

- Less custom connection logic in each app: `getAgent()` handles discovery/handshake.
- Cleaner listener lifecycle: one registration pass per mode, explicit cleanup.
- Easier diagnostics: centralizable logging behavior in `fdc3-web` usage.
- Better alignment with current FDC3 web-direction tooling and test harness patterns.

## Important Caveats

- Sail DA internals remain Sail-native (`packages/web`, `packages/da-impl`); this branch focuses on app-side agent acquisition and wiring.
- Security features are still provided by `@robmoffat/fdc3-security`, so some security app files retain `@robmoffat/fdc3` types for compatibility, even though runtime `getAgent` now routes through `fdc3-web`.
- A complete security-stack type migration would require a `fdc3-security` package alignment to `@finos/fdc3` types.

## Soak Test Results

Validated in this branch:

- `npm install` succeeds.
- `npm run build` succeeds for all workspaces.
- `npm run lint` succeeds.
- `npx tsc -p packages/fdc3-example-apps/tsconfig.json --noEmit` succeeds.
- Runtime startup smoke:
  - `npm run web:dev` starts Sail server at `http://localhost:8090`.
  - `npm run examples:dev` starts all discovered demo apps.
  - HTTP checks passed for Sail root (`302` redirect to `/html/index.html`) and all demo app ports.
  - `GET /polygon-key` returns `200`.
  - generated app directory file exists and was populated.

Not fully validated yet:

- End-to-end user-driven cross-app intent/broadcast workflows in an automated browser script.
- Electron-hosted interaction flows in this branch.

Known unrelated test-suite gap:

- `npm test` currently fails in `packages/da-impl` due missing `@finos/fdc3-testing` module in this standalone repo setup.

## What Cannot Be Ported Yet (Without Additional Work)

An explicit attempt was made to replace all remaining `@robmoffat/fdc3*` imports in security demo code with FINOS equivalents.
That change failed type-check due structural/type-contract mismatches between:

- `@finos/fdc3` `DesktopAgent`/`Channel`/`IntentHandler`
- and `@robmoffat/fdc3-security` expected `@robmoffat/fdc3-standard` types.

Practical impact:

- `fdc3-security` extension points (`connectRemoteHandlers`, handler subclass overrides like `remoteIntentHandler`, `handleRemoteChannel`) currently require legacy-compatible type surfaces.
- Full removal of `@robmoffat/fdc3` from security demo code is blocked until either:
  1. `@robmoffat/fdc3-security` is updated to FINOS type contracts, or
  2. a compatibility shim layer is introduced and maintained around every security integration boundary.

## Recommended Next Step

1. Run end-to-end Sail demo smoke tests for broadcast, intents, TradingView/Polygon updates, and security sender/receiver flows.
2. Decide whether to keep security compatibility casts as-is or align/fork `fdc3-security` to `@finos/fdc3` typing for a fully unified type surface.
3. Evaluate whether Sail DA bootstrap should adopt a root-factory approach from `fdc3-web`, or remain Sail-native with app-side `fdc3-web` only.
