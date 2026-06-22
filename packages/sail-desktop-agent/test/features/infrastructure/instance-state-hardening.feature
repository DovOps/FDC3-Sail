@intents @disconnect
Feature: Instance state hardening (PRD-04e-f)

  Scenario: Instance records do not carry intent listener name arrays
    Given A desktop agent
    When "appId: App1, instanceId: a1" is opened with connection id "a1"
    And "appId: App1, instanceId: a1" registers an intent listener for "ViewPortfolio" [fdc3.addIntentListener]
    Then instance "a1" does not expose a denormalized intent listener name list

  Scenario: Intent listener discovery uses global registry only
    Given "portfolioApp" is an app with the following intents
      | Intent Name   | Context Type   | Result Type | Display Name   |
      | ViewPortfolio | fdc3.portfolio | {empty}     | View Portfolio |
    And A desktop agent
    When "appId: portfolioApp, instanceId: p1" is opened with connection id "p1"
    And "appId: portfolioApp, instanceId: p1" registers an intent listener for "ViewPortfolio" [fdc3.addIntentListener]
    Then intent discovery for "ViewPortfolio" finds listener instance "p1" from the global registry

  Scenario: Disconnected instances are absent not terminated
    Given A desktop agent
    When "appId: App1, instanceId: a1" is opened with connection id "a1"
    And "appId: App1, instanceId: a1" is closed
    Then instance "a1" is not present in agent state
    And no app instance has lifecycle state "terminated"
