# fdc3-web Prototype for Sail Demo Apps

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

## Prototype Scope Implemented in This Branch

This prototype intentionally targets the TraderX-style demo path rather than all Sail apps:

- `packages/fdc3-example-apps/front-end-apps/tradingview/src/TradingViewWidget.tsx`
- `packages/fdc3-example-apps/server-apps/polygon/src/PolygonWidget.tsx`
- `packages/fdc3-example-apps/front-end-apps/tradelist/src/main.ts`
- `packages/fdc3-example-apps/package.json`

### Changes made

1. Migrated those apps to `getAgent()` from `@morgan-stanley/fdc3-web`.
2. For `tradelist`, switched type imports to `@finos/fdc3`.
3. Added `@morgan-stanley/fdc3-web` and `@finos/fdc3` dependencies in `fdc3-example-apps` package.
4. Refactored TradingView/Polygon listener setup to a single lifecycle registration model (no state-driven re-registration loop).
5. Added wildcard context listeners for `fdc3.instrument` parity handling.
6. Added channel-context sync polling for resilience in demo scenarios.

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

- This branch is a **prototype**, not a full Sail migration.
- Sail DA internals are still based on existing Sail runtime packages; this does not replace DA internals with `fdc3-web` root agent.
- Security-demo/server-app paths using `@robmoffat/*` remain unchanged and would require a separate migration plan.

## Recommended Next Step

If this prototype proves stable in runtime smoke tests, progress with a phased migration:

1. finish all example-app migrations,
2. align resolver/channel UI strategy,
3. decide whether DA root creation should remain Sail-native or adopt `fdc3-web` root factory in web runtime bootstrap.
