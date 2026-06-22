---
sidebar_position: 4
---

# FDC3 2.2 conformance traceability map

This document maps FINOS FDC3 2.2 interop / conformance pack areas to in-repo Cucumber BDD scenarios under `packages/sail-desktop-agent/test/features/`. Scenarios tagged `@conformance2.2` are explicit pack alignments; **103 scenarios across 12 feature files** carry that tag (as of this map). Status is honest: `covered` means representative `@conformance2.2` scenarios exist and pass in CI; `partial` means gaps remain; `missing` means no BDD yet; `n/a` means outside the FDC3 2.2 public API conformance surface (e.g. Sail WCP transport).

| Conformance area | Feature file + scenario | Status | Notes/slug |
|---|---|---|---|
| DesktopAgent.getInfo / implementation metadata | `test/features/basic/basic.feature` — GetInfo returns implementation metadata; GetInfo returns optionalFeatures capability flags | partial | Core metadata assertions covered. Toolbox `GetInfo2` timed out in the browser/WCP harness path; owner: **bdd-wcp-integration-scenario**, final attribution in **harness-toolbox-rerun-baseline** |
| User channels (list, join, leave, current) | `test/features/channels/user-channels.feature` — User channels include displayMetadata for all predefined channels; Current context is delivered when joining a user channel; Broadcasting on a user channel does not echo back to the sender | partial | 14 `@conformance2.2` MockTransport scenarios cover API behavior. Toolbox user-channel delivery and ContextMetadata require browser/WCP regression; owners: **bdd-wcp-integration-scenario**, **bind-host-instance-id-at-wcp4**, **context-metadata-conformance-bdd** |
| App channels (create, broadcast, listeners) | `test/features/channels/app-channels.feature` — Broadcasting context on an app channel; Listener subscribed after two broadcasts only receives subsequent broadcasts; getCurrentContext returns latest after multiple broadcasts in order | partial | 11 `@conformance2.2` MockTransport scenarios cover API behavior. Toolbox app-channel delivery still depends on WCP/browser instance routing; owners: **bdd-wcp-integration-scenario**, **bind-host-instance-id-at-wcp4** |
| Private channels | `test/features/channels/private-channel.feature` — Null lifecycle listener receives addContextListener unsubscribe and disconnect events; Disconnecting from a channel sends unsubscribe and disconnect messages | covered | 4 `@conformance2.2` scenarios |
| Context broadcast (user channel) | `test/features/context/broadcast.feature` — Broadcast Event Includes OriginatingApp Metadata; Broadcast Is A No-Op When Not Joined To A User Channel | covered | MockTransport originatingApp and no-op behavior; malformed-context error row covered separately below |
| ContextMetadata on broadcast (`fdc3.contextMetadata`) | `test/features/context/broadcast.feature` — Broadcast Event Includes ContextMetadata With Source And Timestamp | covered | Asserts `metadata.source` (`@finos/fdc3` `ContextMetadata`) and `metadata.timestamp` on `broadcastEvent` DACP payload (mirrors `originatingApp` + `meta.timestamp`; toolbox `UCContextMetadataOnBroadcast` still needs WCP/harness re-run — **harness-toolbox-rerun-baseline**, **bdd-wcp-integration-scenario**) |
| Context / event listeners | `test/features/context/event-listeners.feature` — Receiving channelChanged event when another app joins a channel; addEventListener with null type subscribes to all event types | covered | Listener creation smoke in `test/features/basic/basic.feature` — Context listener for a specific type can be created |
| raiseIntent | `test/features/intents/raise-intent.feature` — Raising an intent that should auto-resolve (only one option); User Cancels The Intent Resolver Returns UserCancelledResolution; Raising An Intent With Malformed Context Returns MalformedContext | partial | MockTransport scenarios cover core behavior, but toolbox launch/delivery rows require host-id/WCP routing and targeted error-code assertions; owners: **fix-cucumber-raise-intent-launch-correlation**, **bind-host-instance-id-at-wcp4**, **fdc3-error-enum-boundary-tests** |
| ContextMetadata on intent (`fdc3.intentContextMetadata`) | `test/features/intents/raise-intent.feature` — Intent Event Includes ContextMetadata With Source And Timestamp | covered | Asserts `metadata.source` and `metadata.timestamp` on `intentEvent` DACP payload (mirrors `originatingApp` + `meta.timestamp`; toolbox `IntentContextMetadata` still needs WCP/harness re-run — **harness-toolbox-rerun-baseline**, **bdd-wcp-integration-scenario**) |
| raiseIntentForContext | `test/features/intents/raise-intent-with-context.feature` — Raising An Intent With Context To A Running App; User Cancels The Intent Resolver Returns UserCancelledResolution | partial | MockTransport scenarios cover running-app behavior. Toolbox launch delivery and context metadata require WCP/browser evidence; owners: **bdd-wcp-integration-scenario**, **context-metadata-conformance-bdd** |
| findIntent / findIntentByContext | `test/features/intents/find-intent.feature` — Successful Find Intents Request; Find Intents by Context Request; Find Intent With Malformed Context Returns MalformedContext | partial | API-area coverage exists, but toolbox oracle checks directory `displayName`, dedupe counts, and `NoAppsFound` error paths; owners: **fix-intent-discovery-displayname-dedupe**, **toolbox-bdd-metadata-assertions**, **fdc3-error-enum-boundary-tests** |
| Intent resolution / IntentResult | `test/features/intents/intent-result.feature` — App Returns An Intent Result; IntentResolution.getResult() rejects with NoResultReturned when handler returns nothing | partial | MockTransport result behavior covered. Toolbox result rows fail through launch/WCP delivery; owners: **fix-cucumber-raise-intent-launch-correlation**, **bdd-wcp-integration-scenario** |
| Apps (metadata, open, open with context, findInstances) | `test/features/apps/apps.feature` — Opening An App; Opening An App With Context; Find Instances with Some Apps Running; Opening An App With Malformed Context Returns MalformedContext | partial | API-area coverage exists, but toolbox oracle requires `desktopAgent`, host-assigned instance id adoption, open-with-context delivery, and WCP-backed `findInstances`; owners: **fix-app-metadata-desktop-agent-field**, **toolbox-bdd-metadata-assertions**, **bind-host-instance-id-at-wcp4**, **bdd-wcp-integration-scenario** |
| Disconnect / lifecycle cleanup | `test/features/apps/disconnect-cleanup.feature` — Apps that disconnect and reconnect to the DA should receive one copy of a broadcast message from an app channel as state was cleaned up; Disconnecting from the DA when subscribed to a private channel channel sends unsubscribe and disconnect messages | partial | P0 source/open-with-context gaps in `test/features/apps/disconnect-cleanup-p0.feature` (not `@conformance2.2`) — **extend-cleanup-source-and-open-with-context** |
| FDC3 error enums (ResolveError, OpenError, ChannelError, …) | `test/features/intents/raise-intent.feature` — Raising An Intent With Malformed Context Returns MalformedContext; `test/features/apps/apps.feature` — Opening A Missing App; `test/features/context/broadcast.feature` — Broadcast With Malformed Context Returns MalformedContext Error | partial | Many scenarios assert error names ad hoc; systematic boundary matrix — **fdc3-error-enum-boundary-tests** |
| WCP transport / browser bridge | — | partial | Cucumber uses `MockTransport`; no `@conformance2.2` WCP path — **bdd-wcp-integration-scenario** |
| Heartbeat / liveness (Sail infrastructure) | `test/features/infrastructure/heartbeat.feature` — App Responds to heartbeats; App Doesn't Respond to heartbeats | n/a | WCP6 heartbeat is Sail transport hygiene, not FDC3 2.2 public API pack; test hygiene — **audit-heartbeat-disconnect-cleanup** |

## Tag inventory (`@conformance2.2`)

- `test/features/basic/basic.feature` — 10
- `test/features/channels/user-channels.feature` — 14
- `test/features/channels/app-channels.feature` — 11
- `test/features/channels/private-channel.feature` — 4
- `test/features/context/broadcast.feature` — 4
- `test/features/context/event-listeners.feature` — 2
- `test/features/intents/raise-intent.feature` — 13
- `test/features/intents/raise-intent-with-context.feature` — 9
- `test/features/intents/find-intent.feature` — 12
- `test/features/intents/intent-result.feature` — 6
- `test/features/apps/apps.feature` — 16
- `test/features/apps/disconnect-cleanup.feature` — 3

**Total: 103** tagged scenarios across 12 feature files.

Files without `@conformance2.2` tags: `test/features/infrastructure/heartbeat.feature`, `test/features/apps/disconnect-cleanup-p0.feature` (lifecycle P0, not pack-tagged).
