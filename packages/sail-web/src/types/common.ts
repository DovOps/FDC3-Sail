// Import shared types from sail-api package
export type {
  TabDetail,
  DirectoryApp,
  WebAppDetails,
  AppHosting,
  InstanceID,
} from "@finos/sail-platform-api"

// Sail app-specific message constants
export const AppManagementMessages = {
  DA_DIRECTORY_LISTING: "DA_DIRECTORY_LISTING",
  FDC3_DA_EVENT: "FDC3_DA_EVENT",
  FDC3_APP_EVENT: "FDC3_APP_EVENT",
}

export interface DesktopAgentDirectoryListingArgs {
  [key: string]: unknown
}

// Handshake message constants
export const HandshakeMessages = {
  APP_HELLO: "APP_HELLO",
}

export interface AppHelloArgs {
  [key: string]: unknown
}
