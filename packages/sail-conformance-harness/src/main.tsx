import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import App from "./App"
import { createHarnessBootstrap } from "./harness-bootstrap"

const { initialPanels, onPanelsChange } = createHarnessBootstrap()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App initialPanels={initialPanels} onPanelsChange={onPanelsChange} />
  </StrictMode>
)
