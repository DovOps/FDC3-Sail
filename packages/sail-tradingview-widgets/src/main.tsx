import { StrictMode, useEffect, useMemo, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import { getAgent } from "@finos/fdc3"
import {
  createTradingViewConfig,
  extractTicker,
  getTradingViewScript,
  resolveMode,
  type TradingViewMode,
} from "./tradingview"
import "./styles.css"

type Listener = {
  unsubscribe?: () => void
}

type CurrentContextAgent = {
  getCurrentContext?: (contextType?: string) => Promise<unknown>
}

const DEFAULT_TICKER = "AAPL"

function renderTradingView(container: HTMLDivElement, mode: TradingViewMode, ticker: string) {
  container.innerHTML = ""
  const widget = document.createElement("div")
  widget.className = "tradingview-widget-container__widget"
  widget.style.height = "100%"
  widget.style.width = "100%"

  const script = document.createElement("script")
  script.type = "text/javascript"
  script.async = true
  script.src = getTradingViewScript(mode)
  script.innerHTML = JSON.stringify(createTradingViewConfig(mode, ticker))

  container.append(widget, script)
}

function TradingViewWidget() {
  const mode = useMemo(() => resolveMode(window.location.search), [])
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [ticker, setTicker] = useState(DEFAULT_TICKER)
  const [status, setStatus] = useState(`Waiting for fdc3.instrument (${DEFAULT_TICKER})`)

  useEffect(() => {
    if (containerRef.current) {
      renderTradingView(containerRef.current, mode, ticker)
    }
  }, [mode, ticker])

  useEffect(() => {
    let listener: Listener | undefined
    let cancelled = false

    const connect = async () => {
      try {
        const agent = await getAgent()
        const currentContext = await (agent as CurrentContextAgent).getCurrentContext?.(
          "fdc3.instrument"
        )
        const currentTicker = extractTicker(currentContext)
        if (!cancelled && currentTicker) {
          setTicker(currentTicker)
          setStatus(`Loaded current fdc3.instrument (${currentTicker})`)
        }

        listener = await agent.addContextListener("fdc3.instrument", context => {
          const receivedTicker = extractTicker(context)
          if (!receivedTicker) {
            return
          }
          setTicker(receivedTicker)
          setStatus(`Received fdc3.instrument (${receivedTicker})`)
        })
      } catch (error) {
        console.warn("[sail-tradingview-widgets] FDC3 connection unavailable", error)
        setStatus("Standalone mode")
      }
    }

    void connect()

    return () => {
      cancelled = true
      listener?.unsubscribe?.()
    }
  }, [])

  return (
    <main className="sail-tradingview-widget">
      <header className="sail-tradingview-toolbar">
        <strong>{mode}</strong>
        <span>{ticker}</span>
        <small className="sail-tradingview-status">{status}</small>
      </header>
      <section ref={containerRef} className="tradingview-widget-container" />
    </main>
  )
}

const root = document.getElementById("root")
if (!root) {
  throw new Error("Missing #root element")
}

createRoot(root).render(
  <StrictMode>
    <TradingViewWidget />
  </StrictMode>
)
