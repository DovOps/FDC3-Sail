Feature: P0 disconnect cleanup (production cleanup path)

  Background:
    Given "portfolioApp" is an app with the following intents
      | Intent Name   | Context Type   | Result Type |
      | ViewPortfolio | fdc3.portfolio | {empty}     |
    And "chartApp" is an app with the following intents
      | Intent Name | Context Type    | Result Type |
      | ViewChart   | fdc3.instrument | {empty}     |
    And A desktop agent
    And "appId: portfolioApp, instanceId: a1" is opened with connection id "a1"

  Scenario: Disconnecting the raising app clears pending intent state
    Given "App1" is an app with the following intents
      | Intent Name   | Context Type   | Result Type |
      | ViewPortfolio | fdc3.portfolio | {empty}     |
    And "PortfolioApp" is an app with the following intents
      | Intent Name   | Context Type   | Result Type |
      | ViewPortfolio | fdc3.portfolio | {empty}     |
    When "appId: PortfolioApp, instanceId: l1" is opened with connection id "l1"
    And "appId: App1, instanceId: app1" is opened with connection id "app1"
    And "appId: PortfolioApp, instanceId: l1" registers an intent listener for "ViewPortfolio" [fdc3.addIntentListener]
    And "appId: App1, instanceId: app1" raises an intent for "ViewPortfolio" with contextType "fdc3.portfolio" on app "appId: PortfolioApp, instanceId: l1" with requestUuid "P0-RAISE-1" [fdc3.raiseIntent]
    And we wait for a period of "100" ms
    And "app1" sends validate
    And "appId: App1, instanceId: app1" disconnects from the DA
    Then the agent has no pending intents
    And no heartbeat timers are active

  Scenario: Disconnecting target app before open-with-context listener clears pending state
    When "appId: portfolioApp, instanceId: a1" opens app "chartApp" with context data "fdc3.instrument" [fdc3.open]
    And "uuid-0" sends validate
    And we wait for a period of "50" ms
    And "appId: chartApp, instanceId: uuid-0" disconnects from the DA
    Then open-with-context pending is empty for instance "appId: chartApp, instanceId: uuid-0"
    And no open-with-context timeouts are scheduled

  Scenario: Production disconnect stops heartbeat timers for the instance
    Given A desktop agent with heartbeat checking
    When "appId: portfolioApp, instanceId: a1" is opened with connection id "a1"
    And "a1" sends validate
    And we wait for a period of "100" ms
    And "appId: portfolioApp, instanceId: a1" sends a goodbye message
    Then no heartbeat timers are active
