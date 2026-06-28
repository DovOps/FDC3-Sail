import { describe, expect, it } from "vite-plus/test"
import {
  createTradingViewConfig,
  extractTicker,
  getTradingViewScript,
  resolveMode,
  toTradingViewSymbol,
} from "./tradingview"

describe("TradingView widget helpers", () => {
  it("resolves supported modes with chart as the default", () => {
    expect(resolveMode("?mode=symbol-info")).toBe("symbol-info")
    expect(resolveMode("?mode=fundamentals")).toBe("fundamentals")
    expect(resolveMode("?mode=unknown")).toBe("chart")
  })

  it("extracts ticker from fdc3.instrument contexts", () => {
    expect(extractTicker({ type: "fdc3.instrument", id: { ticker: " msft " } })).toBe("MSFT")
    expect(extractTicker({ type: "fdc3.contact", id: { ticker: "MSFT" } })).toBeNull()
  })

  it("normalizes symbols for TradingView widgets", () => {
    expect(toTradingViewSymbol("MSFT")).toBe("NASDAQ:MSFT")
    expect(toTradingViewSymbol("NYSE:IBM")).toBe("NYSE:IBM")
  })

  it("creates mode-specific TradingView configs", () => {
    expect(getTradingViewScript("chart")).toContain("advanced-chart")
    expect(getTradingViewScript("symbol-info")).toContain("symbol-info")
    expect(getTradingViewScript("fundamentals")).toContain("financials")
    expect(createTradingViewConfig("chart", "MSFT")).toMatchObject({
      autosize: true,
      symbol: "NASDAQ:MSFT",
    })
  })
})
