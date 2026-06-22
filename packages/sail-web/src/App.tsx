import { SidebarProvider } from "@finos/sail-ui"
import type { SailPlatform } from "@finos/sail-platform-api"

import { AppSidebar } from "./components/sidebar/AppSidebar"
import { ThemeProvider } from "./components/theme/theme-provider"
import { Workspace } from "./components/workspace/Workspace"
import Layout from "./components/layout-grid/Layout"
import { QuickAccessPanel } from "./components/quick-access-panel"
import { IntentResolverDialog } from "./components/intent-resolver"
import { SailDesktopAgentProvider, SailPlatformProvider } from "./contexts"

interface AppProps {
  platform: SailPlatform
}

function App({ platform }: AppProps) {
  return (
    <SailPlatformProvider platform={platform}>
      <SailDesktopAgentProvider platform={platform}>
        <ThemeProvider>
          <SidebarProvider defaultOpen={false}>
            <AppSidebar />
            <main className="flex flex-1 flex-col overflow-hidden">
              <Workspace>
                <Layout />
              </Workspace>
              {/* <SailV3JoinBanner /> */}
            </main>
            <QuickAccessPanel />
            <IntentResolverDialog />
          </SidebarProvider>
        </ThemeProvider>
      </SailDesktopAgentProvider>
    </SailPlatformProvider>
  )
}

export default App
