// TradingViewWidget.jsx
import { getAgent } from "@morgan-stanley/fdc3-web"
import { useEffect, useRef, memo, useState } from "react"
import { PolygonMode } from "./common"
import { newsMode } from "./modes/news"

/* eslint-disable  @typescript-eslint/no-explicit-any */

const MODES: PolygonMode[] = [newsMode]

export const PolygonWidget = ({ mode }: { mode: string }) => {
  const container: any = useRef()
  const modeProps = MODES.find((m) => m.name === mode) ?? MODES[0]

  const [state, setState] = useState<string>(modeProps.initialState)
  const [data, setData] = useState(modeProps.initialData)
  const [apiKey, setApiKey] = useState<string | null>(null)

  useEffect(() => {
    async function fetchApiKey() {
      const key = await getApiKey()
      setApiKey(key)
    }
    fetchApiKey()
  }, [])

  useEffect(() => {
    setState(modeProps.initialState)
    setData(modeProps.initialData)
  }, [mode, modeProps.initialData, modeProps.initialState])

  useEffect(() => {
    let cancelled = false
    let unregisters: Array<() => void> = []
    let syncInterval: number | undefined

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
        applyNextState(context?.id?.ticker)
      } catch (error) {
        console.warn("[polygon] failed to sync current channel context", error)
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
            (context: any) => applyDerivedState(listenerDef.function, context),
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

        await syncCurrentChannelContext(fdc3)
        syncInterval = window.setInterval(() => {
          void syncCurrentChannelContext(fdc3)
        }, 2000)
      } catch (error) {
        console.error("[polygon] failed to connect to desktop agent", error)
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
    }
  }, [mode, modeProps])

  useEffect(() => {
    if (apiKey) {
      const call = modeProps.endpoint(state as any, apiKey)
      fetch(call).then(async (response) => {
        console.log("CALLING POLYGON", response)
        const data = await response.json()
        console.log("data", data)
        setData(() => data)
      })
    }
  }, [state, apiKey])

  return (
    <div id="polygon-widget" ref={container}>
      {modeProps.stateRenderer(state)}
      {modeProps.dataRenderer(data)}
      <div className="polygon-widget-copyright">
        <a
          href="https://www.polygon.io/"
          rel="noopener nofollow"
          target="_blank"
        >
          <span className="blue-text"> Powered by Polygon </span>
        </a>
      </div>
    </div>
  )
}

export default memo(PolygonWidget)

async function getApiKey() {
  const response = await fetch("/polygon-key")
  const data = await response.json()
  return data.key
}
