import { useContext } from "react"
import type { SailPlatform } from "@finos/sail-platform-api"

import type { AppDirectoryStore } from "../stores/app-directory-store"
import type { ConnectionStore } from "../stores/connection-store"
import type { IntentResolverStore } from "../stores/intent-resolver-store"

import { SailDesktopAgentContext } from "./SailDesktopAgentContextValue"

export function useSailDesktopAgent(): SailPlatform["agent"] {
  const context = useContext(SailDesktopAgentContext)
  if (!context) {
    throw new Error("useSailDesktopAgent must be used within SailDesktopAgentProvider")
  }
  return context.platform.agent
}

export function useAppDirectoryStore(): AppDirectoryStore {
  const context = useContext(SailDesktopAgentContext)
  if (!context) {
    throw new Error("useAppDirectoryStore must be used within SailDesktopAgentProvider")
  }
  return context.useAppDirectoryStore()
}

export function useConnectionStore(): ConnectionStore {
  const context = useContext(SailDesktopAgentContext)
  if (!context) {
    throw new Error("useConnectionStore must be used within SailDesktopAgentProvider")
  }
  return context.useConnectionStore()
}

export function useIntentResolverStore(): IntentResolverStore {
  const context = useContext(SailDesktopAgentContext)
  if (!context) {
    throw new Error("useIntentResolverStore must be used within SailDesktopAgentProvider")
  }
  return context.useIntentResolverStore()
}
