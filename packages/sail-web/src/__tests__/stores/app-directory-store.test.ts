import { describe, expect, it, vi } from "vite-plus/test"
import type { SailPlatform } from "@finos/sail-platform-api"
import { createAppDirectoryStore } from "../../stores/app-directory-store"

const createPlatform = (directoryUrls: string[] = []) =>
  ({
    agent: {
      getState: vi.fn(() => ({
        appDirectory: {
          directoryUrls,
          apps: [
            {
              appId: "traderx-web",
              name: "TraderX",
              title: "TraderX",
              type: "web",
              details: {
                url: "http://localhost:8080/trade",
              },
            },
          ],
        },
      })),
    },
  }) as unknown as SailPlatform

describe("app-directory-store", () => {
  it("loads apps and mirrors directory URLs from the agent state", () => {
    const platform = createPlatform(["http://localhost:8080/fdc3/appd/v2/apps"])
    const store = createAppDirectoryStore(platform)

    store.getState().loadApps()

    expect(store.getState().apps.map(app => app.appId)).toEqual(["traderx-web"])
    expect(store.getState().directoryUrls).toEqual(["http://localhost:8080/fdc3/appd/v2/apps"])
  })
})
