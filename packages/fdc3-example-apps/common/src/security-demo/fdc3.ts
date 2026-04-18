import type { DesktopAgent } from "@robmoffat/fdc3"
import { getAgent as getWebAgent } from "@morgan-stanley/fdc3-web"
import { createLogEntry, updateStatus } from "./logging"

// Initialize FDC3 connection
export async function initializeFDC3(): Promise<DesktopAgent> {
  try {
    updateStatus("connecting", "Connecting to FDC3 Agent...")
    createLogEntry("info", "🚀 Connecting to FDC3 Agent...", {
      status: "Initializing",
      timestamp: new Date().toISOString(),
    })

    // Keep legacy DesktopAgent typing for security-demo compatibility.
    const fdc3 = (await getWebAgent()) as unknown as DesktopAgent

    updateStatus("connected", "Connected to FDC3 Agent")
    createLogEntry("success", "✅ Connected to FDC3 Agent successfully", {
      agent: "FDC3 Agent",
      timestamp: new Date().toISOString(),
      capabilities: "Available",
    })

    return fdc3
  } catch (error) {
    updateStatus("error", "FDC3 Connection Failed")
    createLogEntry("error", "❌ Failed to connect to FDC3 Agent", {
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    })
    throw error
  }
}
