Feature: Heartbeat Messages Between Apps and Server

  Background:
    Given "portfolioApp" is an app with the following intents
      | Intent Name   | Context Type   | Result Type |
      | ViewPortfolio | fdc3.portfolio | {empty}     |
    And A desktop agent with heartbeat checking

  Scenario: App Responds to heartbeats
    When "appId: portfolioApp, instanceId: a1" is opened with connection id "a1"
    And "a1" sends validate
    And we wait for a period of "500" ms
    And "appId: portfolioApp, instanceId: a1" sends a heartbeat response to eventUuid "a1_1"
    And we wait for a period of "500" ms
    And "appId: portfolioApp, instanceId: a1" sends a heartbeat response to eventUuid "a1_2"
    And we wait for a period of "500" ms
    And "appId: portfolioApp, instanceId: a1" sends a heartbeat response to eventUuid "a1_3"
    And we wait for a period of "500" ms
    And "appId: portfolioApp, instanceId: a1" sends a heartbeat response to eventUuid "a1_4"
    And we wait for a period of "500" ms
    And "appId: portfolioApp, instanceId: a1" sends a heartbeat response to eventUuid "a1_5"
    And we wait for a period of "500" ms
    Then I test the liveness of "appId: portfolioApp, instanceId: a1"
    Then "{result}" is true
    And messaging will include outgoing posts
      | msg.matches_type |
      | heartbeatEvent   |
    And I shutdown the server
    And I get the heartbeat times
    Then "{result}" is an array of objects with the following contents
      | instanceId | state |

  Scenario: App Doesn't Respond to heartbeats
  Apps are considered dead if they don't respond to a heartbeat request within 2 seconds

    When "appId: portfolioApp, instanceId: a1" is opened with connection id "a1"
    And "a1" sends validate
    And we wait for a period of "3000" ms
    Then I test the liveness of "appId: portfolioApp, instanceId: a1"
    Then "{result}" is false
    And messaging will have outgoing heartbeat events for the WCP-validated instance
      | msg.matches_type | to.instanceId | to.appId     |
      | heartbeatEvent   | a1            | portfolioApp |
      | heartbeatEvent   | a1            | portfolioApp |
      | heartbeatEvent   | a1            | portfolioApp |
      | heartbeatEvent   | a1            | portfolioApp |
    And I shutdown the server
    And I get the heartbeat times
    Then "{result}" is empty

  Scenario: Heartbeat timeout clears DA event listeners
    When "appId: portfolioApp, instanceId: a1" is opened with connection id "a1"
    And "a1" sends validate
    And the WCP-validated instance for app "portfolioApp" adds an event listener for "channelChanged" [fdc3.addEventListener]
    And we wait for a period of "3000" ms
    Then no DA event listeners remain for the WCP-validated instance
    And I shutdown the server

  Scenario: App says Goodbye
    When "appId: portfolioApp, instanceId: a1" is opened with connection id "a1"
    And "a1" sends validate
    And we wait for a period of "500" ms
    And "appId: portfolioApp, instanceId: a1" sends a goodbye message
    Then I test the liveness of "appId: portfolioApp, instanceId: a1"
    Then "{result}" is false
    And I shutdown the server
