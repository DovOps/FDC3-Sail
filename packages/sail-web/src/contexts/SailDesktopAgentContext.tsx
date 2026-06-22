import { useMemo, type ReactNode } from "react"
import type { SailPlatform } from "@finos/sail-platform-api"

import { createAppDirectoryStore } from "../stores/app-directory-store"
import { createConnectionStore } from "../stores/connection-store"
import { createIntentResolverStore } from "../stores/intent-resolver-store"

import { SailDesktopAgentContext } from "./sail-desktop-agent-context-value"

interface SailDesktopAgentProviderProps {
  platform: SailPlatform
  children: ReactNode
}

export function SailDesktopAgentProvider({ platform, children }: SailDesktopAgentProviderProps) {
  // Create the app directory store once with the platform injected
  const appDirectoryStore = useMemo(() => createAppDirectoryStore(platform), [platform])

  // Create the connection store once with the platform injected
  const connectionStore = useMemo(() => createConnectionStore(platform), [platform])

  // Create the intent resolver store once with the platform injected
  const intentResolverStore = useMemo(() => createIntentResolverStore(platform), [platform])

  const value = useMemo(
    () => ({
      platform,
      useAppDirectoryStore: appDirectoryStore,
      useConnectionStore: connectionStore,
      useIntentResolverStore: intentResolverStore,
    }),
    [platform, appDirectoryStore, connectionStore, intentResolverStore]
  )

  return (
    <SailDesktopAgentContext.Provider value={value}>{children}</SailDesktopAgentContext.Provider>
  )
}
