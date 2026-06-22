import { useState, useMemo } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@finos/sail-ui"
import { Check, Circle, X } from "lucide-react"

import { useSailPlatform } from "../../contexts"

interface Channel {
  id: string
  type: string
  displayMetadata?: {
    name?: string
    color?: string
    glyph?: string
  }
}

interface ChannelMenuProps {
  trigger: React.ReactNode
  selectedChannelId?: string | null
  onChannelSelect?: (channelId: string | null) => void
}

export const ChannelMenu = ({ trigger, selectedChannelId, onChannelSelect }: ChannelMenuProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const platform = useSailPlatform()

  // Get user channels from the Desktop Agent
  const channels = useMemo<Channel[]>(() => {
    try {
      return platform.getUserChannels()
    } catch (error) {
      console.error("[ChannelMenu] Failed to get user channels:", error)
      return []
    }
  }, [platform])

  const handleChannelClick = (channelId: string) => {
    if (selectedChannelId === channelId) {
      // Clicking selected channel deselects it (leave channel)
      onChannelSelect?.(null)
    } else {
      onChannelSelect?.(channelId)
    }
    setIsOpen(false)
  }

  const handleLeaveChannel = () => {
    onChannelSelect?.(null)
    setIsOpen(false)
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="end">
        <div className="flex flex-col gap-1">
          <div className="px-2 py-1 text-xs font-medium text-muted-foreground">User Channels</div>
          {channels.map(channel => {
            const isSelected = selectedChannelId === channel.id
            const color = channel.displayMetadata?.color
            const name = channel.displayMetadata?.name || channel.id

            return (
              <button
                key={channel.id}
                onClick={() => handleChannelClick(channel.id)}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors
                  ${isSelected ? "bg-accent" : "hover:bg-accent/50"}`}
              >
                {color && <Circle className="size-3" style={{ fill: color, stroke: color }} />}
                <span className="flex-1 text-left">{name}</span>
                {isSelected && <Check className="size-4 text-primary" />}
              </button>
            )
          })}

          {selectedChannelId && (
            <>
              <hr className="my-1 border-border" />
              <button
                onClick={handleLeaveChannel}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-accent/50"
              >
                <X className="size-3" />
                <span>Leave Channel</span>
              </button>
            </>
          )}

          {channels.length === 0 && (
            <div className="px-2 py-1 text-sm text-muted-foreground">No channels available</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
