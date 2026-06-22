Feature: Basic Tests

  Background:
    Given "handlerApp" is an app with the following intents
      | Intent Name | Context Type    | Result Type |
      | BasicView   | fdc3.instrument | {empty}     |
    And A desktop agent
    And "appId: appA, instanceId: a1" is opened with connection id "a1"
    And "appId: handlerApp, instanceId: h1" is opened with connection id "h1"
    And "appId: handlerApp, instanceId: h1" registers an intent listener for "BasicView" [fdc3.addIntentListener]

  @conformance2.2
  Scenario: GetInfo returns implementation metadata
    When "appId: appA, instanceId: a1" requests info on the DesktopAgent [fdc3.getInfo]
    Then messaging will have outgoing posts
      | msg.payload.implementationMetadata.fdc3Version | msg.payload.implementationMetadata.provider | to.instanceId | msg.matches_type |
      |                                            2.2 | cucumber-provider                           | a1            | getInfoResponse  |

  @conformance2.2
  Scenario: GetInfo returns optionalFeatures capability flags
    When "appId: appA, instanceId: a1" requests info on the DesktopAgent [fdc3.getInfo]
    Then messaging will have outgoing posts
      | msg.matches_type | to.instanceId | msg.payload.implementationMetadata.optionalFeatures.DesktopAgentBridging | msg.payload.implementationMetadata.optionalFeatures.OriginatingAppMetadata | msg.payload.implementationMetadata.optionalFeatures.UserChannelMembershipAPIs |
      | getInfoResponse  | a1            | false                                                                     | true                                                                        | true                                                                          |

  @conformance2.2
  Scenario: GetUserChannels returns user channels
    When "appId: appA, instanceId: a1" gets the list of user channels [fdc3.getUserChannels]
    Then messaging will have outgoing posts
      | msg.payload.userChannels[0].id | msg.payload.userChannels[0].type | to.instanceId | msg.matches_type        |
      | fdc3.channel.1                 | user                             | a1            | getUserChannelsResponse |

  @conformance2.2
  Scenario: Context listener for a specific type can be created
    When "appId: appA, instanceId: a1" adds a context listener on "{null}" with type "fdc3.contact" [fdc3.addContextListener]
    Then messaging will have outgoing posts
      | msg.matches_type           | to.instanceId |
      | addContextListenerResponse | a1            |

  @conformance2.2
  Scenario: Unfiltered context listener can be created
    When "appId: appA, instanceId: a1" adds a context listener on "{null}" with type "{null}" [fdc3.addContextListener]
    Then messaging will have outgoing posts
      | msg.matches_type           | to.instanceId |
      | addContextListenerResponse | a1            |

  @conformance2.2
  Scenario: Intent listener can be created
    When "appId: appA, instanceId: a1" registers an intent listener for "BasicView" [fdc3.addIntentListener]
    Then messaging will have outgoing posts
      | msg.matches_type          | to.instanceId |
      | addIntentListenerResponse | a1            |

  @conformance2.2
  Scenario: App channel can be created
    When "appId: appA, instanceId: a1" creates or gets an app channel called "basicAppChannel" [fdc3.getOrCreateChannel]
    Then messaging will have outgoing posts
      | msg.matches_type           | msg.payload.channel.id | msg.payload.channel.type | to.instanceId |
      | getOrCreateChannelResponse | basicAppChannel        | app                      | a1            |

  @conformance2.2
  Scenario: User channel can be joined and left
    When "appId: appA, instanceId: a1" joins user channel "fdc3.channel.1" [fdc3.joinUserChannel]
    And "appId: appA, instanceId: a1" gets the current user channel [fdc3.getCurrentChannel]
    And "appId: appA, instanceId: a1" leaves the current user channel [fdc3.leaveCurrentChannel]
    And "appId: appA, instanceId: a1" gets the current user channel [fdc3.getCurrentChannel]
    Then messaging will have outgoing posts
      | msg.matches_type            | msg.payload.channel.id | msg.payload.channelId | msg.payload.identity.instanceId | to.instanceId |
      | joinUserChannelResponse     | {null}                 | {null}                | {null}                          | a1            |
      | getCurrentChannelResponse   | fdc3.channel.1         | {null}                | {null}                          | a1            |
      | leaveCurrentChannelResponse | {null}                 | {null}                | {null}                          | a1            |
      | getCurrentChannelResponse   | {null}                 | {null}                | {null}                          | a1            |

  @conformance2.2
  Scenario: Intent can be raised
    When "appId: appA, instanceId: a1" raises an intent for "BasicView" with contextType "fdc3.instrument" [fdc3.raiseIntent]
    Then messaging will have outgoing posts
      | msg.matches_type    | to.instanceId |
      | intentEvent         | h1            |
      | raiseIntentResponse | a1            |

  @conformance2.2
  Scenario: Intent can be raised for context
    When "appId: appA, instanceId: a1" raises an intent with contextType "fdc3.instrument" [fdc3.raiseIntentForContext]
    Then messaging will have outgoing posts
      | msg.matches_type              | to.instanceId |
      | intentEvent                   | h1            |
      | raiseIntentForContextResponse | a1            |
