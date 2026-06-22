/* oxlint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from "react"
import type { SailPlatform } from "@finos/sail-platform-api"

const SailPlatformContext = createContext<SailPlatform | null>(null)

interface SailPlatformProviderProps {
  platform: SailPlatform
  children: ReactNode
}

export function SailPlatformProvider({ platform, children }: SailPlatformProviderProps) {
  return <SailPlatformContext.Provider value={platform}>{children}</SailPlatformContext.Provider>
}

export function useSailPlatform(): SailPlatform {
  const platform = useContext(SailPlatformContext)
  if (!platform) {
    throw new Error("useSailPlatform must be used within SailPlatformProvider")
  }
  return platform
}
