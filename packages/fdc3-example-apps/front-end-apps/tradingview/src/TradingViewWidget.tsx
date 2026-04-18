// TradingViewWidget.jsx
import { getAgent } from "@morgan-stanley/fdc3-web"
import { useEffect, useRef, memo, useState } from "react"

/* eslint-disable  @typescript-eslint/no-explicit-any */

import { TradingViewMode } from "./common"
import { chartMode } from "./modes/chart"
import { symbolInfoMode } from "./modes/symbol-info"
import { fundamentalsMode } from "./modes/fundamentals"
import { tickersMode } from "./modes/tickers"
import { marketDataMode } from "./modes/market-data"

const MODES: TradingViewMode[] = [
  chartMode,
  symbolInfoMode,
  fundamentalsMode,
  tickersMode,
  marketDataMode,
]

export const TradingViewWidget = ({ mode }: { mode: string }) => {
  const container: any = useRef()
  const modeProps = MODES.find((m) => m.name === mode) ?? MODES[0]

  const [state, setState] = useState<string>(modeProps.initialState)

  useEffect(() => {
    setState(modeProps.initialState)
  }, [mode, modeProps.initialState])

  useEffect(() => {
    let cancelled = false
    let unregisters: Array<() => void> = []
    let syncInterval: number | undefined
    let channelChangedListener: any

    const shouldSyncFromChannel = (() => {
      const value = new URLSearchParams(window.location.search).get(
        "listenChannelContext",
      )
      if (value == null) {
        return true
      }
      return value !== "false"
    })()

    const normalizeTicker = (value: unknown): string | null => {
      if (typeof value !== "string") {
        return null
      }
      const trimmed = value.trim().toUpperCase()
      if (!trimmed) {
        return null
      }
      if (trimmed.includes(":")) {
        const suffix = trimmed.split(":").pop()?.trim().toUpperCase()
        return suffix ?? null
      }
      return trimmed
    }

    const applyNextState = (candidate: unknown) => {
      const normalized = normalizeTicker(candidate)
      if (normalized == null) {
        return
      }
      setState((previous: string) =>
        previous === normalized ? previous : normalized,
      )
    }

    const applyDerivedState = (
      transform: (context: any, state: any) => any,
      context: any,
    ) => {
      setState((previous: string) => {
        const candidate = transform(context, previous)
        const normalized = normalizeTicker(candidate)
        if (normalized == null) {
          return previous
        }
        return previous === normalized ? previous : normalized
      })
    }

    const syncCurrentChannelContext = async (fdc3: any) => {
      if (typeof fdc3?.getCurrentChannel !== "function") {
        return
      }
      try {
        const channel = await fdc3.getCurrentChannel()
        if (typeof channel?.getCurrentContext !== "function") {
          return
        }
        const context = await channel.getCurrentContext("fdc3.instrument")
        const ticker = context?.id?.ticker
        applyNextState(ticker)
      } catch (error) {
        console.warn(
          "[tradingview] failed to sync current channel context",
          error,
        )
      }
    }

    const connect = async () => {
      try {
        const fdc3 = await getAgent()
        if (cancelled) {
          return
        }

        for (const intent of modeProps.intents) {
          const listener = await fdc3.addIntentListener(
            intent.name,
            (context: any) => {
              applyDerivedState(intent.function, context)
            },
          )
          if (typeof listener?.unsubscribe === "function") {
            unregisters.push(() => listener.unsubscribe())
          }
        }

        for (const listenerDef of modeProps.listeners) {
          const listener = await fdc3.addContextListener(
            listenerDef.name,
            (context: any) => {
              applyDerivedState(listenerDef.function, context)
            },
          )
          if (typeof listener?.unsubscribe === "function") {
            unregisters.push(() => listener.unsubscribe())
          }
        }

        const wildcard = await fdc3.addContextListener((context: any) => {
          const contextType = context?.type
          if (!contextType) {
            return
          }
          modeProps.listeners
            .filter((listenerDef) => listenerDef.name === contextType)
            .forEach((listenerDef) =>
              applyDerivedState(listenerDef.function, context),
            )
        })
        if (typeof wildcard?.unsubscribe === "function") {
          unregisters.push(() => wildcard.unsubscribe())
        }

        if (shouldSyncFromChannel) {
          await syncCurrentChannelContext(fdc3)

          channelChangedListener = () => {
            void syncCurrentChannelContext(fdc3)
          }
          const channelChangeSubscription = await fdc3.addEventListener(
            "userChannelChanged",
            channelChangedListener,
          )
          if (typeof channelChangeSubscription?.unsubscribe === "function") {
            unregisters.push(() => channelChangeSubscription.unsubscribe())
          }

          syncInterval = window.setInterval(() => {
            void syncCurrentChannelContext(fdc3)
          }, 1500)
        }
      } catch (error) {
        console.error("[tradingview] failed to connect to desktop agent", error)
      }
    }

    void connect()

    return () => {
      cancelled = true
      unregisters.forEach((fn) => fn())
      unregisters = []
      if (syncInterval != null) {
        window.clearInterval(syncInterval)
      }
      channelChangedListener = undefined
    }
  }, [mode, modeProps])

  useEffect(() => {
    let script: HTMLScriptElement | null = null

    script = document.getElementById(
      "tradingview-widget-script",
    ) as HTMLScriptElement

    if (script) {
      container.current.removeChild(script)
    }

    script = document.createElement("script")
    container.current.appendChild(script)

    script.id = "tradingview-widget-script"
    script.src = modeProps.script

    script.type = "text/javascript"
    script.async = true
    // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
    script.innerHTML = modeProps.innerHTML(state as any)
  }, [state])

  return (
    <div
      className="tradingview-widget-container"
      ref={container}
      style={{ height: "100%", width: "100%" }}
    >
      <div
        className="tradingview-widget-container__widget"
        style={{ height: "calc(100% - 32px)", width: "100%" }}
      ></div>
      <div className="tradingview-widget-copyright">
        <a
          href="https://www.tradingview.com/"
          rel="noopener nofollow"
          target="_blank"
        >
          <span className="blue-text"> Track all markets on TradingView </span>
        </a>
      </div>
    </div>
  )
}

export default memo(TradingViewWidget)
