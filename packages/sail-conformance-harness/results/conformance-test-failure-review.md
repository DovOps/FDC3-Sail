# FDC3 Toolbox conformance — failure review

Attribution matrix for the FINOS FDC3 conformance toolbox against `@finos/sail-conformance-harness` (clean-room host, port **3001**). **Current baseline: `conformance-report-v5.txt` (53 pass / 49 fail, 102 scenarios).** Older harness exports (v3, v4) are kept for progression history only.

## Sources

| File | Notes |
|------|--------|
| `conformance-report-v3.txt` | First harness clean-room run — **15 pass / 45 fail**, ~155s |
| `conformance-report-v4.txt` | Measured harness export — **31 pass / 64 fail**, ~305s, **95 scenarios** |
| `conformance-report-v5.txt` | **Current baseline** — **53 pass / 49 fail**, ~516s, **102 scenarios** |
| `../conformance-appd.json` | FINOS conformance app directory; merged in `packages/sail-web/src/main.tsx` and loaded by the harness |

Removed from repo (2026-06): `conformance-report.txt` and `conformance-report-v2.txt` — early dumps from the full **sail-web** stack (`:3000`), not comparable to harness clean-room runs.

The harness exercises **browser WCP + `@finos/sail-desktop-agent`** only (no `SailPlatform`). In-repo BDD uses `MockTransport` — documented in `website/docs/packages/desktop-agent/conformance.md` (**104** `@conformance2.2` scenarios, **2** `@conformance3.0` in `close.feature`).

## Harness progression (v3 → v5)

| Export | Pass / fail | Scenarios | Dominant failure symptom |
|--------|-------------|-----------|--------------------------|
| v3 | 15 / 45 | ~60 | `AppTimeout` — delivery never reached mock apps |
| v4 | 31 / 64 | 95 | `AppTimeout` (~33) + agent oracle rows |
| v5 | **53 / 49** | 102 | **Close-context teardown (26)** + client metadata (4) + stale `findIntent` inflation |

**v4 → v5 delta:** Passes **+22**, failures **−15**, scenarios **+7** (`fdc3.intentListenerConflict` — all pass). Symptom shift: **`AppTimeout` (~33 → 1)** — one residual open-path timeout (`AOpensBWithWrongContext`); **`UserCancelledResolution` (9 → 0)**; new dominant cluster **`App didn't return close context within 1 sec` (26)** plus **6** explicit Mocha timeouts (3×20s open, 1×10s GetInfo2, 2×80s delayed results).

---

## Attribution summary (v5 baseline)

| Layer | v5 share of remaining 49 failures | Confidence |
|--------|-----------------------------------|------------|
| **Harness session hygiene** | **Largest** — 26 close-context rows; stale instances inflate `findIntent` (`apps.length` 4 vs 1); open-with-context 20s timeouts (3); `findInstances` instanceId mismatch (1) | High |
| **@finos/sail-desktop-agent** (client + DACP path) | **`getResultMetadata` empty (4)**, **`desktopAgent` missing (2)**, intent context traceId (1), `findIntent` wrong-context `NoAppsFound` (1), `raiseIntent` throws message (3) | High |
| **@finos/sail-web** (`:3000`) | Deferral for harness work — launch context, resolver UI, cross-origin panels still apply to full stack only | High |
| **Blocked on FINOS** | `findIntent` dedupe / `NoAppsFound` / throws matrix (~6 rows) — policy before code | Medium |

**Takeaway:** v5 proves **delivery works** (UCR and bulk AppTimeout cleared). Remaining pain is **FINOS scenario teardown** (mock apps must return close context between scenarios) and **client-side metadata APIs**, not missing DACP handlers.

---

## v5 remaining failures by symptom

### A. Close-context teardown (26 rows) — harness first

**Areas:** `fdc3.appChannels` (9), `fdc3.userChannels` (12), `fdc3.contextMetadata` (5).

**Pattern:** Scenario completes but the mock app does not return close context / call `fdc3.close()` within 1s before the next scenario. Popups and WCP instances accumulate, inflating stale `findIntent` counts.

**Owner:** `fix-harness-finOs-session-teardown` (with `harness-popup-wcp-disconnect-cleanup`).

### B. Client metadata API (7 rows) — desktop-agent

| Symptom | Rows | Owner |
|---------|------|-------|
| `getResultMetadata()` returns empty while result resolves | 4 | `fix-toolbox-metadata-client-and-dacp-paths` |
| `AppMetadata` missing `desktopAgent` on harness path | 2 | same |
| Intent `ContextMetadata` traceId not forwarded (`intent-trace-456`) | 1 | same |

Wire metadata on `raiseIntentResultResponse` is done (`populate-intent-result-metadata-toolbox`); toolbox still red until the **FDC3 client** exposes `getResultMetadata()`.

### C. findIntent / findIntentsByContext (4 rows) — hygiene + blocked policy

- **`apps.length` 4 vs 1** (2 `findIntent` + 1 `findIntentsByContext`) — stale CONNECTED instances; fix teardown before dedupe policy.
- **Wrong context `NoAppsFound`** (1) — `assert.fail()` vs `NoAppsFound`; blocked: `fix-findintent-empty-apps-noappsfound`.
- **`raiseIntent` throws** wrong `message` (3) — blocked: `align-raise-intent-throws-v4-matrix`.

### D. Open / timing (5 rows)

- Open-with-context **20s Mocha timeouts** (3): `AOpensBWithContext3`, `AOpensBWithSpecificContext`, `AOpensBMultipleListen`.
- **`AOpensBWithWrongContext`** — 1 App timeout (residual delivery edge).
- **`GetInfo2`** — 10s timeout (1).
- **61s delayed intent results** — 2× 80s Mocha timeout (agent/toolbox budget).

### E. Cleared in v5 (keep regression nets green)

`basicRI1`/`basicRI2`, intent Result delivery (void/context/channel/private, 5s), `RaiseIntentSingleResolve`, `fdc3.intentListenerConflict` (7), base `IntentContextMetadata`, bulk channel/open delivery (no bulk AppTimeout).

### Full-stack deferral (`sail-web` :3000 only)

Launch context dropped, cross-origin conformance iframes, intent resolver UI automation — relevant when comparing harness (:3001) vs platform (:3000), not the current v5 baseline host.

---

## 5. BDD blind-spot audit (v3)

The traceability map is useful for API-area coverage, but several `covered` rows are not equivalent to the FINOS toolbox oracle. This matrix separates exact field/assertion gaps from MockTransport-vs-WCP/browser gaps and records the regression owner that must close each non-deferred category before the burn-down epic can be treated as complete.

| v3 failure category | Toolbox symptom | Classification | Owner slug | v4 measured | v5 measured | Required regression net |
|---|---|---|---|---|---|---|
| `getAppMetadata` / `AppInstanceMetadata` missing `desktopAgent` | Metadata validator expected `desktopAgent` | Product bug (harness DACP path?) | **`fix-toolbox-metadata-client-and-dacp-paths`** | **Still failing** (2) | **Still failing** (2) | Harness-path Vitest repro |
| `findIntent` deep-equal / apps.length | `AppIntent.apps.length` N vs 1 | Product bug + session hygiene | `dedupe-findintent-directory-running-apps`; **`fix-harness-finOs-session-teardown`** | **2 vs 1** (2 rows) | **4 vs 1** (2 rows) — stale instances | Teardown first, then blocked dedupe |
| `findIntentsByContext` count | length N vs 1 | Product bug + session hygiene | `dedupe-findintent-directory-running-apps`; **`fix-harness-finOs-session-teardown`** | **2 vs 1** (1 row) | **4 vs 1** (1 row) | Same |
| `findIntent` wrong context | `NoAppsFound` vs `assert.fail()` | Product bug | `fix-findintent-empty-apps-noappsfound` | **Still failing** (1) | **Still failing** (1) | Blocked on FINOS clarification |
| `getResultMetadata` on intent results | `expected '' to not equal ''` | Product bug — client API gap | `populate-intent-result-metadata-toolbox` (wire); **`fix-toolbox-metadata-client-and-dacp-paths`** | **2 rows** (+ UCR on siblings) | **4 rows** — delivery passes, metadata API empty | Client API + harness re-run |
| `raiseIntent (Result)` | `UserCancelledResolution` | Mixed harness / agent | `diagnose-harness-user-cancelled-resolution` | **9 rows** | **0 rows** — cleared | Spike done; no Phase 2 |
| `raiseIntent` throws | Wrong error `message` | Product bug | `align-raise-intent-throws-v4-matrix` | **4 rows** | **4 rows** (different messages) | Blocked with findIntent policy |
| `fdc3.open` / channels / metadata | `AppTimeout` / close-context | WCP integration + teardown | `pre-register-conformance1-pending-instance`; **`fix-harness-finOs-session-teardown`** | **~33 AppTimeout** | **1 AppTimeout**; **26** close-context; **6** Mocha timeout | Grouped harness teardown task |
| `findInstances` | Missing / wrong instanceId | Integration | **`fix-harness-finOs-session-teardown`** | `IntentDeliveryFailed` | **instanceId mismatch** (1 row) | Launcher ↔ WCP5 correlation |
| `intentContextMetadata` traceId | App traceId not forwarded | Product bug | **`fix-toolbox-metadata-client-and-dacp-paths`** | `IntentDeliveryFailed` | **1 row** — antiReplay/traceId | Intent raise event metadata |

---

## 5.1 Spike: harness `UserCancelledResolution` (TV4-06 Phase 1)

v4 reports **9** `UserCancelledResolution` rows under `fdc3.raiseIntent (Result)`. **v5: 0 rows** — void/context/channel/private-channel delivery scenarios pass (including 5s delays). Phase 2 fix task is **not required** for the UCR symptom.

Remaining Result failures in v5 are **`getResultMetadata` empty (4 rows)** and **61s delay Mocha timeouts (2 rows)** — see §5 matrix.

| Symptom | v4 | v5 | Owner |
|---------|----|----|-------|
| Void/context/channel result → `UserCancelledResolution` | 9 rows | **0** | Cleared by harness resolver + delivery fixes |
| `getResultMetadata` empty while result resolves | 2+ rows | **4 rows** | **New task:** wire metadata to FDC3 client `getResultMetadata()` |
| Channel/private-channel → `IntentDeliveryFailed` | 2 rows | **0** | Cleared |
| 61s delayed result scenarios | UCR / fail | **2×** `Timeout of 80000ms exceeded` | Environment/toolbox budget or agent timeout tuning — triage separately |

**Recommended follow-up:** Close spike `diagnose-harness-user-cancelled-resolution` as done. Open **`wire-intent-result-metadata-to-client-api`** — DACP `raiseIntentResultResponse.payload.metadata` is populated (Vitest/Cucumber green) but conformance app `getResultMetadata()` still returns empty.

---

## TB-08 v4 harness re-run — measured baseline (2026-06)

Manual acceptance step for the toolbox-conformance-burn-down epic. v3-pre merged PRs for TB-01 (`desktopAgent`), TB-02 (`displayName`/dedupe), TB-04b (host↔WCP instance bind), and TB-05 (Cucumber raise-intent launch correlation) before this doc update.

### Procedure

1. From repo root: `nvm use 24`, `npm install` (if needed).
2. Start the clean-room harness: `npm run dev -w @finos/sail-conformance-harness`.
3. Open **http://localhost:3001** in a browser (Conformance1 loads automatically).
4. Run the **full FINOS toolbox export** inside Conformance1 (browser UI — not reliable headless in cloud VM).
5. Save export as `packages/sail-conformance-harness/results/conformance-report-v4.txt` (or the next versioned filename).
6. Update this doc if counts change on the next export.

See `packages/sail-conformance-harness/README.md` for architecture and instance-identity notes.

### Measured v4 summary

| Metric | v3 | v4 | Source |
|--------|----|----|--------|
| Pass | **15** | **31** | `conformance-report-v3.txt` / `conformance-report-v4.txt` |
| Fail | **45** | **64** | same |
| Scenarios | ~60 | **95** | v4 runs full FINOS pack |
| Duration | ~155s | ~305s | same |
| `AppTimeout` | ~35+ | **~33** | grep v4 export |
| `UserCancelledResolution` | — | **9** | raiseIntent Result rows |
| Agent oracle (metadata / findIntent / getResultMetadata) | — | **8+** | see §5 matrix |

### TV4-07 verification (current `v3-pre` code vs v4 export)

| v4 row | Code on branch | Verdict |
|--------|----------------|---------|
| `GetAppMetadata` / `AppInstanceMetadata` missing `desktopAgent` | `convertDirectoryAppToAppMetadata` always sets `desktopAgent: provider` (`app-handlers.ts`) | **Likely stale v4 export or harness DACP path** — Vitest `app-metadata-desktop-agent.test.ts` green; re-run toolbox before re-opening TB-01 |
| `FindIntentAppD*` apps.length 2 vs 1 | `createAppIntents` still merges directory + running rows | **Open product bug** — owner `dedupe-findintent-directory-running-apps` (blocked) |
| `getResultMetadata` empty | No `metadata` on `raiseIntentResultResponse` before TV4-03 fix | **Open product bug** — fixed in `populate-intent-result-metadata-toolbox` |

**Re-run commands (after delivery batch):**

```bash
nvm use 24
npm run dev -w @finos/sail-conformance-harness   # http://localhost:3001
# Run full toolbox export in Conformance1 UI; save conformance-report-v5.txt
```

Targeted Vitest (changed packages only):

```bash
npm test -w @finos/sail-desktop-agent -- intent-result-metadata wcp-desktop-agent.integration
npm test -w @finos/sail-conformance-harness
```

### Post-merge expected category movement

*Historical — superseded by measured v4 (TB-08) and v5 (TB-09) exports above.*

### Raw export policy

Committed harness exports: `conformance-report-v3.txt`, `conformance-report-v4.txt`, `conformance-report-v5.txt` under `packages/sail-conformance-harness/results/`. Record future runs as `conformance-report-v6.txt` in the same folder. Removed early sail-web dumps (`conformance-report.txt`, `conformance-report-v2.txt`) — not comparable to harness clean-room runs.

---

## TB-09 v5 harness re-run — measured baseline (2026-06-19)

Post-delivery batch: Conformance1 pre-register, popup `disconnectInstance`, intent result wire metadata, WCP two-app channel Vitest, harness resolver wiring.

### Measured v5 summary

| Metric | v4 | v5 | Δ |
|--------|----|----|---|
| Pass | **31** | **53** | **+22** |
| Fail | **64** | **49** | **−15** |
| Scenarios | **95** | **102** | +7 (`intentListenerConflict` — all pass) |
| Duration | ~305s | ~516s | longer (61s delay cases run) |
| `AppTimeout` | **~33** | **1** (`AOpensBWithWrongContext`) | bulk delivery fixed |
| `UserCancelledResolution` | **9** | **0** | resolver + delivery fixed |
| `App didn't return close context within 1 sec` | (subset) | **26** | dominant new failure cluster |
| `getResultMetadata` empty | **2** (+ UCR siblings) | **4** | wire fixed; client API not |
| `findIntent` apps.length | **2 vs 1** | **4 vs 1** | stale instances worse across run |

### v5 wins (batch attribution)

| Area | v4 → v5 |
|------|---------|
| `basicRI1`, `basicRI2` | fail → **pass** |
| `fdc3.open` no-context / AppNotFound / `AOpensB4` | improved (`AOpensBWithWrongContext` still 1 App timeout) |
| `raiseIntent (Result)` delivery (void, context, channel, private channel, 5s) | **pass** |
| `RaiseIntentSingleResolve`, `RaiseIntentTargetedAppResolve`, private channel raiseIntent | **pass** |
| `PrivateChannels*` raiseIntent scenarios | **pass** |
| `fdc3.intentListenerConflict` (7 scenarios) | **new + all pass** |
| `IntentContextMetadata` (base scenario) | **pass** |

### TV4-07 re-verification (v5 export)

| Row | v5 verdict |
|-----|------------|
| `desktopAgent` on getAppMetadata | **Still failing** — not stale export; harness or DACP response path omits field despite merged TB-01 |
| `findIntent` apps.length | **Still failing, worse (4 vs 1)** — stale CONNECTED instances from incomplete teardown inflate count |
| `getResultMetadata` | **Still failing (4 rows)** — `populate-intent-result-metadata-toolbox` fixed wire payload only; client `getResultMetadata()` empty |

**Re-run commands:**

```bash
nvm use 24
npm run dev -w @finos/sail-conformance-harness   # http://localhost:3001
# Full toolbox export in Conformance1 UI → conformance-report-v6.txt
npm test -w @finos/sail-desktop-agent -- intent-result-metadata intent-result-handlers wcp-desktop-agent.integration
npm test -w @finos/sail-conformance-harness
npx cucumber-js --profile single test/features/intents/intent-result.feature -w @finos/sail-desktop-agent
```

---

## 6. Work-item coverage vs v5 remaining failures

### Existing queue — still applies (unblock or extend)

| Slug | Status | Fixes v5 rows? | Notes |
|------|--------|----------------|-------|
| `populate-intent-result-metadata-toolbox` | in-progress | **Partial** | Wire metadata on `raiseIntentResultResponse` — done. Toolbox still red until client API wired. |
| `dedupe-findintent-directory-running-apps` | blocked | **Yes (2–3 rows)** when unblocked | v5 count **4** suggests stale instances dominate — teardown may need to land first |
| `fix-findintent-empty-apps-noappsfound` | blocked | **Yes (1 row)** | Depends on dedupe |
| `align-raise-intent-throws-v4-matrix` | blocked | **Yes (~4 rows)** | Depends on findIntent chain |
| `pre-register-conformance1-pending-instance` | in-progress | **Done for v5** | Open tests improved; mark done after approve |
| `harness-popup-wcp-disconnect-cleanup` | in-progress | **Partial** | Popup disconnect helps; **26** close-context failures remain |
| `extend-wcp-channel-delivery-integration-tests` | in-progress | **Regression net only** | Vitest green; toolbox teardown still fails |
| `diagnose-harness-user-cancelled-resolution` | in-progress | **Done** | UCR cleared in v5 — close spike |
| `record-toolbox-v4-measured-baseline` | in-progress | Docs | Extend with v5 (this doc) |
| `verify-v4-agent-fixes-on-current-branch` | in-progress | Docs | TV4-07 updated for v5 |

### New work items (v5 wave — filed)

| Slug | Kind | v5 rows | Scope |
|------|------|---------|-------|
| **`epic-toolbox-conformance-v5-follow-up`** | epic | — | Coordinates v5 → v6 wave |
| **`fix-toolbox-metadata-client-and-dacp-paths`** | task | ~7 | `getResultMetadata` (4), `desktopAgent` (2), intent context traceId (1) |
| **`fix-harness-finOs-session-teardown`** | task | ~30+ | Close-context (26), stale findIntent inflation, open 20s timeouts, findInstances instanceId |

**No new item needed:** TV4-06 Phase 2 (`UserCancelledResolution`) — v5 cleared the symptom; close spike `diagnose-harness-user-cancelled-resolution`.

**Blocked until FINOS:** `dedupe-findintent-directory-running-apps`, `fix-findintent-empty-apps-noappsfound`, `align-raise-intent-throws-v4-matrix` — still own **~6 agent-oracle rows** once unblocked; stale-instance teardown should land first so toolbox counts are trustworthy.

---

## 7. Recommended investigation order

1. **`fix-toolbox-metadata-client-and-dacp-paths`** — `getResultMetadata`, `desktopAgent`, intent context app metadata.  
2. **`fix-harness-finOs-session-teardown`** — close-context, stale instances, open timeouts, findInstances correlation.  
3. **Unblock findIntent policy** with FINOS — then deliver dedupe + NoAppsFound + throws matrix.  
4. **Re-run toolbox** → `conformance-report-v6.txt`.

## 8. Related repo docs

- `website/docs/packages/desktop-agent/conformance.md` — BDD ↔ FDC3 2.2 areas  
- `plans/prd-desktop-agent-conformance-gaps.md` — Planned hardening (cleanup, WCP BDD, error enums)  
- `AGENTS.md` — WCP temp vs canonical ids, testing conventions  

---

## 9. Bottom line

| Question | Answer |
|----------|--------|
| Did the v4 follow-up batch help? | **Yes — +22 passes to v5.** UCR and bulk AppTimeout cleared; intent Result delivery mostly green. |
| Is `populate-intent-result-metadata-toolbox` done? | **Partial** — wire yes; client path owned by **`fix-toolbox-metadata-client-and-dacp-paths`**. |
| Are **any** failures still in sail-desktop-agent? | **Yes** — client metadata API, `desktopAgent` on harness path, findIntent shape (blocked), throws matrix (blocked), intent context traceId. |
| Where is most v5 pain? | **Harness session hygiene** (~26 close-context) + **client metadata wiring** (4 rows). |
| Existing queue enough? | **Partially** — v5 wave filed as `epic-toolbox-conformance-v5-follow-up` (2 grouped tasks); blocked findIntent items still apply after teardown + FINOS. |

*Review date: 2026-06-20. **Current baseline: v5.** Historical progression: v3, v4. Re-run procedure in [TB-09 v5](#tb-09-v5-harness-re-run--measured-baseline-2026-06-19).*
