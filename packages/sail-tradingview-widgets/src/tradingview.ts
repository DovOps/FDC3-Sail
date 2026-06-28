export type TradingViewMode = "chart" | "symbol-info" | "fundamentals"

export interface InstrumentContext {
  type: "fdc3.instrument"
  id?: {
    ticker?: string
    FIGI?: string
    ISIN?: string
    [key: string]: unknown
  }
  name?: string
}

export function resolveMode(search: string): TradingViewMode {
  const mode = new URLSearchParams(search).get("mode")
  if (mode === "symbol-info" || mode === "fundamentals") {
    return mode
  }
  return "chart"
}

export function extractTicker(context: unknown): string | null {
  const candidate = context as InstrumentContext | null | undefined
  if (candidate?.type !== "fdc3.instrument") {
    return null
  }
  const ticker = candidate.id?.ticker ?? candidate.name
  if (!ticker) {
    return null
  }
  const normalized = ticker.trim().toUpperCase()
  return normalized.length > 0 ? normalized : null
}

export function toTradingViewSymbol(ticker: string): string {
  return ticker.includes(":") ? ticker : `NASDAQ:${ticker}`
}

export function getTradingViewScript(mode: TradingViewMode): string {
  if (mode === "chart") {
    return "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js"
  }
  if (mode === "symbol-info") {
    return "https://s3.tradingview.com/external-embedding/embed-widget-symbol-info.js"
  }
  return "https://s3.tradingview.com/external-embedding/embed-widget-financials.js"
}

export function createTradingViewConfig(
  mode: TradingViewMode,
  ticker: string
): Record<string, unknown> {
  const symbol = toTradingViewSymbol(ticker)
  if (mode === "chart") {
    return {
      autosize: true,
      symbol,
      interval: "D",
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      allow_symbol_change: true,
      support_host: "https://www.tradingview.com",
    }
  }

  return {
    symbol,
    width: "100%",
    height: "100%",
    locale: "en",
    colorTheme: "dark",
    isTransparent: false,
  }
}
