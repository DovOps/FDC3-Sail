import { After } from "@cucumber/cucumber"
import { clearAllHeartbeatTimersForTesting } from "../../src/core/handlers/dacp/heartbeat-runtime"
import { clearAllPendingOpenWithContextTimeoutsForTesting } from "../../src/core/handlers/dacp/utils/open-with-context"

/**
 * Reset module-level timers after every scenario so the Cucumber process can exit
 * cleanly (heartbeat and open-with-context scenarios schedule real timeouts).
 *
 * Assertions that cleanup worked belong in feature steps (e.g. "no heartbeat timers
 * are active"), not on scenario tags — see AGENTS.md (Cucumber tags).
 */
After(function () {
  clearAllHeartbeatTimersForTesting()
  clearAllPendingOpenWithContextTimeoutsForTesting()
})
