Feature: Relaying Private Channel Broadcast messages

  Background:
    Given "appId: App1, instanceId: a1" is opened with connection id "a1"
    And "appId: App2, instanceId: a2" is opened with connection id "a2"
    And "appId: App2, instanceId: a1" creates a private channel [fdc3.createPrivateChannel]
    #TODO: have a2 retrieve the private channel by raising an intent - its currently using a1 reference to the channel
    And I refer to "uuid3" as "channel1Id"

  Scenario: Creating a new private channel
    When "appId: App2, instanceId: a1" creates a private channel [fdc3.createPrivateChannel]
    Then messaging will have outgoing posts
      | msg.matches_type             | msg.payload.privateChannel.type | to.appId | to.instanceId |
      | createPrivateChannelResponse | private                         | App2     | a1            |

  Scenario: Broadcast message to no-one
    When "appId: App1, instanceId: a1" broadcasts "fdc3.instrument" on "{channel1Id}" [fdc3.broadcast]
    Then messaging will have outgoing posts
      | msg.matches_type  |
      | broadcastResponse |

  Scenario: Broadcast message sent to one listener
    When "appId: App2, instanceId: a2" adds a context listener on "{channel1Id}" with type "fdc3.instrument" [fdc3.addContextListener]
    And "appId: App1, instanceId: a1" broadcasts "fdc3.instrument" on "{channel1Id}" [fdc3.broadcast]
    Then messaging will have outgoing posts
      | msg.matches_type           | msg.payload.channelId | msg.payload.context.id.ticker | msg.payload.context.type | to.appId | to.instanceId |
      | addContextListenerResponse | {null}                | {null}                        | {null}                   | App2     | a2            |
      | broadcastEvent             | {channel1Id}          | AAPL                          | fdc3.instrument          | App2     | a2            |
      | broadcastResponse          | {null}                | {null}                        | {null}                   | App1     | a1            |

  @conformance2.2
  Scenario: Null lifecycle listener receives addContextListener unsubscribe and disconnect events
    When "appId: App2, instanceId: a2" adds a catch-all private channel event listener on "{channel1Id}" [PrivateChannel.addEventListener]
    And "appId: App1, instanceId: a1" adds a context listener on "{channel1Id}" with type "fdc3.instrument" [fdc3.addContextListener]
    And we wait for a period of "10" ms
    And "appId: App1, instanceId: a1" disconnects from private channel "{channel1Id}" [PrivateChannel.disconnect]
    Then messaging will have outgoing posts
      | msg.matches_type                        | to.appId | to.instanceId | msg.payload.privateChannelId | msg.payload.contextType |
      | privateChannelAddEventListenerResponse  | App2     | a2            | {null}                       | {null}                  |
      | privateChannelOnAddContextListenerEvent | App2     | a2            | {channel1Id}                 | fdc3.instrument         |
      | addContextListenerResponse              | App1     | a1            | {null}                       | {null}                  |
      | privateChannelOnUnsubscribeEvent        | App2     | a2            | {channel1Id}                 | fdc3.instrument         |
      | privateChannelOnDisconnectEvent         | App2     | a2            | {channel1Id}                 | {null}                  |
      | privateChannelDisconnectResponse        | App1     | a1            | {null}                       | {null}                  |

  @conformance2.2
  Scenario: Event Listener created for addContextListener and unsubscribe
    When "appId: App2, instanceId: a2" adds an "addContextListener" event listener on "{channel1Id}" [PrivateChannel.addEventListener]
    And "appId: App2, instanceId: a2" adds an "unsubscribe" event listener on "{channel1Id}" [PrivateChannel.addEventListener]
    And "appId: App1, instanceId: a1" adds a context listener on "{channel1Id}" with type "fdc3.instrument" [fdc3.addContextListener]
    And we wait for a period of "10" ms
    Then messaging will have outgoing posts
      | msg.matches_type                        | to.appId | to.instanceId | msg.payload.privateChannelId | msg.payload.contextType |
      | privateChannelAddEventListenerResponse  | App2     | a2            | {null}                       | {null}                  |
      | privateChannelAddEventListenerResponse  | App2     | a2            | {null}                       | {null}                  |
      | privateChannelOnAddContextListenerEvent | App2     | a2            | {channel1Id}                 | fdc3.instrument         |
      | addContextListenerResponse              | App1     | a1            | {null}                       | {null}                  |
    And "appId: App1, instanceId: a1" removes context listener with id "{lastContextListenerId}" [fdc3.removeContextListener]
    Then messaging will have outgoing posts
      | msg.type                           | msg.payload.privateChannelId | msg.payload.contextType | to.appId | to.instanceId |
      | privateChannelOnUnsubscribeEvent   | {channel1Id}                 | fdc3.instrument         | App2     | a2            |
      | contextListenerUnsubscribeResponse | {null}                       | {null}                  | App1     | a1            |

  @conformance2.2
  Scenario: Disconnecting from a channel sends unsubscribe and disconnect messages
    When "appId: App2, instanceId: a2" adds an "disconnect" event listener on "{channel1Id}" [PrivateChannel.addEventListener]
    And "appId: App1, instanceId: a1" adds a context listener on "{channel1Id}" with type "fdc3.instrument" [fdc3.addContextListener]
    And "appId: App2, instanceId: a2" adds an "unsubscribe" event listener on "{channel1Id}" [PrivateChannel.addEventListener]
    And "appId: App1, instanceId: a1" disconnects from private channel "{channel1Id}" [PrivateChannel.disconnect]
    Then messaging will have outgoing posts
      | msg.matches_type                 | msg.payload.privateChannelId | msg.payload.contextType | to.appId | to.instanceId |
      | privateChannelOnUnsubscribeEvent | {channel1Id}                 | fdc3.instrument         | App2     | a2            |
      | privateChannelOnDisconnectEvent  | {channel1Id}                 | {null}                  | App2     | a2            |
      | privateChannelDisconnectResponse | {null}                       | {null}                  | App1     | a1            |

  Scenario: addContextListener Event Listener add and removed, shouldn't fire when addContextListener called.
    When "appId: App2, instanceId: a2" adds an "addContextListener" event listener on "{channel1Id}" [PrivateChannel.addEventListener]
    And "appId: App2, instanceId: a2" removes event listener "{lastPrivateChannelEventListenerId}" [PrivateChannel.removeContextListener]
    And "appId: App1, instanceId: a1" adds a context listener on "{channel1Id}" with type "fdc3.instrument" [fdc3.addContextListener]
    Then messaging will have outgoing posts
      | msg.matches_type                               | to.appId | to.instanceId | msg.payload.privateChannelId | msg.payload.contextType |
      | privateChannelAddEventListenerResponse         | App2     | a2            | {null}                       | {null}                  |
      | privateChannelUnsubscribeEventListenerResponse | App2     | a2            | {null}                       | {null}                  |
      | addContextListenerResponse                     | App1     | a1            | {null}                       | {null}                  |

  @conformance2.2
  Scenario: I can't register an app channel with the same ID as a private channel
    When "appId: App2, instanceId: a2" creates or gets an app channel called "{channel1Id}" [fdc3.getOrCreateChannel]
    Then messaging will have outgoing posts
      | msg.type                   | to.appId | to.instanceId | msg.payload.error |
      | getOrCreateChannelResponse | App2     | a2            | AccessDenied      |

  Scenario: Subscribe to a non-existent channel
    When "appId: App2, instanceId: a2" adds a context listener on "IDontExist" with type "fdc3.instrument" [fdc3.addContextListener]
    Then messaging will have outgoing posts
      | msg.type                   | to.appId | to.instanceId | msg.payload.error |
      | addContextListenerResponse | App2     | a2            | NoChannelFound    |

  Scenario: Can't unsubscribe an unconnected listener
    When "appId: App2, instanceId: a2" adds a context listener on "{channel1Id}" with type "fdc3.instrument" [fdc3.addContextListener]
    And "appId: App2, instanceId: a2" removes context listener with id "{lastContextListenerId}" [fdc3.removeContextListener]
    And "appId: App2, instanceId: a2" removes context listener with id "{lastContextListenerId}" [fdc3.removeContextListener]
    Then messaging will have outgoing posts
      | msg.type                           | to.appId | to.instanceId | msg.payload.error |
      | contextListenerUnsubscribeResponse | App2     | a2            | {null}            |
      | contextListenerUnsubscribeResponse | App2     | a2            | ListenerNotFound  |

  Scenario: Can't unsubscribe an someone else's listener
    When "appId: App2, instanceId: a2" adds a context listener on "{channel1Id}" with type "fdc3.instrument" [fdc3.addContextListener]
    And "appId: App1, instanceId: a1" removes context listener with id "{lastContextListenerId}" [fdc3.removeContextListener]
    Then messaging will have outgoing posts
      | msg.type                           | to.appId | to.instanceId | msg.payload.error |
      | addContextListenerResponse         | App2     | a2            | {null}            |
      | contextListenerUnsubscribeResponse | App1     | a1            | ListenerNotFound  |
