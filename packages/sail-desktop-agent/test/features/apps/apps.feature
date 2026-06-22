Feature: Opening and Requesting App Details

  Background:
    Given "portfolioApp" is an app with the following intents
      | Intent Name   | Context Type   | Result Type |
      | ViewPortfolio | fdc3.portfolio | {empty}     |
    And "chartApp" is an app with the following intents
      | Intent Name | Context Type   | Result Type |
      | ViewChart   | fdc3.portfolio | fdc3.chart  |
    And A desktop agent
    And "appId: portfolioApp, instanceId: a1" is opened with connection id "a1"

  @conformance2.2
  Scenario: Looking up app metadata
    When "appId: portfolioApp, instanceId: a1" requests metadata for "chartApp" [fdc3.getAppMetadata]
    Then messaging will have outgoing posts
      | msg.payload.appMetadata.appId | msg.payload.appMetadata.desktopAgent | to.instanceId | msg.matches_type       |
      | chartApp                      | cucumber-provider                    | a1            | getAppMetadataResponse |

  Scenario: Looking up app metadata from missing app
    When "appId: portfolioApp, instanceId: a1" requests metadata for "unknownApp" [fdc3.getAppMetadata]
    Then messaging will have outgoing posts
      | msg.payload.error    | to.instanceId | msg.type               |
      | TargetAppUnavailable | a1            | getAppMetadataResponse |

  @conformance2.2
  Scenario: Looking up app metadata for non-running app from directory
    Given "researchApp" is an app with the following intents
      | Intent Name    | Context Type   | Result Type |
      | ViewResearch   | fdc3.instrument | {empty}    |
    And A desktop agent
    And "appId: portfolioApp, instanceId: a1" is opened with connection id "a1"
    When "appId: portfolioApp, instanceId: a1" requests metadata for "researchApp" [fdc3.getAppMetadata]
    Then messaging will have outgoing posts
      | msg.payload.appMetadata.appId | msg.payload.appMetadata.title | msg.payload.appMetadata.desktopAgent | to.instanceId | msg.matches_type       |
      | researchApp                   | researchApp                   | cucumber-provider                    | a1            | getAppMetadataResponse |

  @conformance2.2
  Scenario: Looking up app metadata for running app includes instanceId
    Given "chartApp" is an app with the following intents
      | Intent Name | Context Type   | Result Type |
      | ViewChart   | fdc3.instrument | {empty}    |
    And A desktop agent
    And "appId: portfolioApp, instanceId: a1" is opened with connection id "a1"
    And "appId: chartApp, instanceId: chart-123" is opened with connection id "chart-123"
    When "appId: portfolioApp, instanceId: a1" requests metadata for "chartApp" [fdc3.getAppMetadata]
    Then messaging will have outgoing posts
      | msg.payload.appMetadata.appId | msg.payload.appMetadata.instanceId | msg.payload.appMetadata.desktopAgent | to.instanceId | msg.matches_type       |
      | chartApp                      | chart-123                          | cucumber-provider                    | a1            | getAppMetadataResponse |

  @conformance2.2
  Scenario: Looking up DesktopAgent metadata
    When "appId: portfolioApp, instanceId: a1" requests info on the DesktopAgent [fdc3.getInfo]
    Then messaging will have outgoing posts
      | msg.payload.implementationMetadata.provider | to.instanceId | msg.matches_type |
      | cucumber-provider                           | a1            | getInfoResponse  |

  @conformance2.2
  Scenario: getInfo returns app metadata for the requesting app
    When "appId: portfolioApp, instanceId: a1" requests info on the DesktopAgent [fdc3.getInfo]
    Then messaging will have outgoing posts
      | msg.payload.implementationMetadata.appMetadata.appId | msg.payload.implementationMetadata.appMetadata.instanceId | to.instanceId | msg.matches_type |
      | portfolioApp                                         | a1                                                        | a1            | getInfoResponse  |

  @conformance2.2
  Scenario: Opening An App
    When "appId: portfolioApp, instanceId: a1" opens app "chartApp" [fdc3.open]
    And "uuid-0" sends validate
    Then messaging will have outgoing posts
      | msg.type                        | msg.payload.appIdentifier.appId | msg.payload.appIdentifier.instanceId | msg.payload.appId | msg.payload.instanceId | to.instanceId |
      | WCP5ValidateAppIdentityResponse | {empty}                         | {empty}                              | chartApp          | {empty}                | {empty}       |
      | openResponse                    | chartApp                        | uuid-0                               | {empty}           | {empty}                | a1            |

  Scenario: Chart App Reconnects
    When "appId: portfolioApp, instanceId: a1" opens app "chartApp" [fdc3.open]
    And "uuid-0" sends validate
    And we wait for a period of "100" ms
    And "uuid-0" revalidates
    Then messaging will have outgoing posts
      | msg.type                        | msg.payload.appIdentifier.appId | msg.payload.appIdentifier.instanceId | msg.payload.appId | msg.payload.instanceId | to.instanceId |
      | WCP5ValidateAppIdentityResponse | {empty}                         | {empty}                              | chartApp          | {empty}                | {empty}       |
      | openResponse                    | chartApp                        | uuid-0                               | {empty}           | {empty}                | a1            |
      | WCP5ValidateAppIdentityResponse | {empty}                         | {empty}                              | chartApp          | {empty}                | {empty}       |

  @conformance2.2
  Scenario: Opening An App With Context
    When "appId: portfolioApp, instanceId: a1" opens app "chartApp" with context data "fdc3.instrument" [fdc3.open]
    And "uuid-0" sends validate
    And we wait for a period of "100" ms
    And "appId: chartApp, instanceId: uuid-0" adds a context listener on "{null}" with type "fdc3.instrument" [fdc3.addContextListener]
    Then messaging will have outgoing posts
      | msg.type                        | msg.payload.channelId | msg.payload.context.type | to.instanceId |
      | WCP5ValidateAppIdentityResponse | {empty}               | {empty}                  | {empty}       |
      | addContextListenerResponse      | {empty}               | {empty}                  | uuid-0        |
      | broadcastEvent                  | {null}                | fdc3.instrument          | uuid-0        |
      | openResponse                    | {empty}               | {empty}                  | a1            |

  @conformance2.2
  Scenario: Opening An App With Context times out without a listener
    When "appId: portfolioApp, instanceId: a1" opens app "chartApp" with context data "fdc3.instrument" [fdc3.open]
    And "uuid-0" sends validate
    And we wait for the listener timeout
    Then messaging will have outgoing posts
      | msg.type                        | msg.payload.error | to.instanceId |
      | WCP5ValidateAppIdentityResponse | {null}            | {empty}       |
      | openResponse                    | AppTimeout        | a1            |

  @conformance2.2
  Scenario: Opening An App With Context to an unfiltered listener
    When "appId: portfolioApp, instanceId: a1" opens app "chartApp" with context data "fdc3.instrument" [fdc3.open]
    And "uuid-0" sends validate
    And we wait for a period of "100" ms
    And "appId: chartApp, instanceId: uuid-0" adds a context listener on "{null}" with type "{null}" [fdc3.addContextListener]
    Then messaging will have outgoing posts
      | msg.type                        | msg.payload.channelId | msg.payload.context.type | to.instanceId |
      | WCP5ValidateAppIdentityResponse | {null}                | {null}                   | {empty}       |
      | addContextListenerResponse      | {null}                | {null}                   | uuid-0        |
      | broadcastEvent                  | {null}                | fdc3.instrument          | uuid-0        |
      | openResponse                    | {null}                | {null}                   | a1            |

  @conformance2.2
  Scenario: Opening An App With Context with multiple listeners
    When "appId: portfolioApp, instanceId: a1" opens app "chartApp" with context data "fdc3.instrument" [fdc3.open]
    And "uuid-0" sends validate
    And we wait for a period of "100" ms
    And "appId: chartApp, instanceId: uuid-0" adds a context listener on "{null}" with type "fdc3.instrument" [fdc3.addContextListener]
    And "appId: chartApp, instanceId: uuid-0" adds a context listener on "{null}" with type "fdc3.country" [fdc3.addContextListener]
    Then messaging will have outgoing posts
      | msg.type                        | msg.payload.channelId | msg.payload.context.type | to.instanceId |
      | WCP5ValidateAppIdentityResponse | {null}                | {null}                   | {empty}       |
      | addContextListenerResponse      | {null}                | {null}                   | uuid-0        |
      | addContextListenerResponse      | {null}                | {null}                   | uuid-0        |
      | broadcastEvent                  | {null}                | fdc3.instrument          | uuid-0        |
      | openResponse                    | {null}                | {null}                   | a1            |

  @conformance2.2
  Scenario: Opening A Missing App
    When "appId: portfolioApp, instanceId: a1" opens app "missingApp" [fdc3.open]
    Then messaging will have outgoing posts
      | msg.type     | msg.payload.error | to.instanceId |
      | openResponse | AppNotFound       | a1            |

  @conformance2.2
  Scenario: Opening An App That Fails To Launch Returns ErrorOnLaunch
    Given the app launcher will fail on launch for "chartApp"
    When "appId: portfolioApp, instanceId: a1" opens app "chartApp" [fdc3.open]
    Then messaging will have outgoing posts
      | msg.matches_type | msg.payload.error | to.instanceId |
      | openResponse     | ErrorOnLaunch     | a1            |

  @conformance2.2
  Scenario: Find Instances with No Apps Running
    And "appId: portfolioApp, instanceId: a1" findsInstances of "chartApp" [fdc3.findInstances]
    Then messaging will have outgoing posts
      | msg.matches_type      | msg.payload.appIdentifiers.length | to.instanceId |
      | findInstancesResponse |                                 0 | a1            |

  @conformance2.2
  Scenario: Find Instances for Unknown App Returns NoAppsFound
    And "appId: portfolioApp, instanceId: a1" findsInstances of "unknownApp" [fdc3.findInstances]
    Then messaging will have outgoing posts
      | msg.matches_type      | msg.payload.error | to.instanceId |
      | findInstancesResponse | NoAppsFound       | a1            |

  @conformance2.2
  Scenario: Find Instances with Some Apps Running
    When "appId: chartApp, instanceId: b1" is opened with connection id "b1"
    And "appId: chartApp, instanceId: b2" is opened with connection id "b2"
    And "appId: portfolioApp, instanceId: a1" findsInstances of "chartApp" [fdc3.findInstances]
    And we wait for a period of "100" ms
    Then messaging will have outgoing posts
      | msg.matches_type      | msg.payload.appIdentifiers.length | msg.payload.appIdentifiers[0].instanceId | msg.payload.appIdentifiers[1].instanceId | to.instanceId | msg.payload.appId |
      | findInstancesResponse |                                 2 | b1                                       | b2                                       | a1            | {null}            |

  @conformance2.2
  Scenario: Opening An App With Malformed Context Returns MalformedContext
    When "appId: portfolioApp, instanceId: a1" opens app "chartApp" with context data "fdc3.malformed" [fdc3.open]
    Then messaging will have outgoing posts
      | msg.matches_type | msg.payload.error | to.instanceId |
      | openResponse     | MalformedContext  | a1            |

  Scenario: Unknown App Attempts Reconnect
    When "uuid-0" revalidates
    Then messaging will have outgoing posts
      | msg.type                              | msg.payload.message           |
      | WCP5ValidateAppIdentityFailedResponse | App not found in app directory |
