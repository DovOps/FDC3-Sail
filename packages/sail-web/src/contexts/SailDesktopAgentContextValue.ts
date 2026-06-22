import { createContext } from "react"
import type { SailPlatform } from "@finos/sail-platform-api"
import type { createAppDirectoryStore } from "../stores/app-directory-store"
import type { createConnectionStore } from "../stores/connection-store"
import type { createIntentResolverStore } from "../stores/intent-resolver-store"

export interface SailDesktopAgentContextValue {
  platform: SailPlatform
  useAppDirectoryStore: ReturnType<typeof createAppDirectoryStore>
  useConnectionStore: ReturnType<typeof createConnectionStore>
  useIntentResolverStore: ReturnType<typeof createIntentResolverStore>
}

export const SailDesktopAgentContext = createContext<SailDesktopAgentContextValue>(
  {} as SailDesktopAgentContextValue
)
