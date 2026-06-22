import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import type { BrowserTypes } from "@finos/fdc3"
import { useStore, type StoreApi } from "zustand"

import { useSailPlatform, useConnectionStore } from "../contexts"
import type { ConnectionStore } from "../stores/connection-store"

interface ChannelSelectorProps {
  instanceId: string
}

export function ChannelSelector({ instanceId }: ChannelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const platform = useSailPlatform()
  const platformRef = useRef(platform)
  platformRef.current = platform

  const connectionStore = useConnectionStore()
  const storeApi = connectionStore as unknown as StoreApi<ConnectionStore>
  // Subscribe to connection-store push updates (channelChanged) — not agent state snapshots.
  const connection = useStore(storeApi, state => state.getConnection(instanceId))
  const currentChannelId = connection?.channelId ?? null

  const channels = useMemo<BrowserTypes.Channel[]>(() => {
    try {
      return platformRef.current.channels.getUserChannels()
    } catch (err) {
      console.error("[ChannelSelector] Failed to get user channels:", err)
      return []
    }
    // User channels are fixed at Desktop Agent construction.
  }, [])

  const currentChannel = channels.find(channel => channel.id === currentChannelId)
  const currentColor = currentChannel?.displayMetadata?.color ?? "#808080"

  useEffect(() => {
    if (!connection) {
      setIsOpen(false)
    }
  }, [connection])

  const handleSelectChannel = async (channelId: string | null) => {
    setIsLoading(true)
    setError(null)

    try {
      // channels.changeAppChannel resolves after onAppChannelChange push; store updates via apps/channels subscriptions.
      await platformRef.current.channels.changeAppChannel(instanceId, channelId)
      setIsOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change channel")
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      setIsOpen(false)
    }
  }

  return (
    <div className="relative" onKeyDown={handleKeyDown}>
      <button
        onClick={() => setIsOpen(prev => !prev)}
        disabled={isLoading}
        className="relative w-4 h-4 rounded-full border-2 border-white shadow-sm"
        style={{ backgroundColor: currentColor }}
        title={currentChannel?.displayMetadata?.name ?? "No channel"}
        aria-label={currentChannel?.displayMetadata?.name ?? "No channel"}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </button>

      {isOpen && (
        <div
          className="absolute top-6 right-0 bg-white rounded-lg shadow-lg p-2 z-50 min-w-[140px]"
          role="menu"
        >
          <button
            onClick={() => void handleSelectChannel(null)}
            className={`flex items-center gap-2 w-full px-2 py-1 rounded hover:bg-gray-100 ${
              currentChannelId === null ? "bg-gray-100" : ""
            }`}
            role="menuitem"
          >
            <div className="w-3 h-3 rounded-full bg-gray-400 border border-gray-300" />
            <span className="text-sm">No channel</span>
          </button>

          {channels.map(channel => (
            <button
              key={channel.id}
              onClick={() => void handleSelectChannel(channel.id)}
              className={`flex items-center gap-2 w-full px-2 py-1 rounded hover:bg-gray-100 ${
                currentChannelId === channel.id ? "bg-gray-100" : ""
              }`}
              role="menuitem"
            >
              <div
                className="w-3 h-3 rounded-full border border-gray-300"
                style={{ backgroundColor: channel.displayMetadata?.color ?? "#808080" }}
              />
              <span className="text-sm">{channel.displayMetadata?.name ?? channel.id}</span>
            </button>
          ))}

          {error && (
            <div className="text-red-500 text-xs mt-2 px-2">
              {error}
              <button onClick={() => setError(null)} className="ml-2 underline">
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}

      {isOpen && <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />}
    </div>
  )
}
