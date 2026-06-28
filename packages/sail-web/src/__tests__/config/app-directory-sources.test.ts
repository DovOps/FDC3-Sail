import { describe, expect, it } from "vite-plus/test"
import { parseAppDirectoryUrls } from "../../config/app-directory-sources"

describe("app directory source config", () => {
  it("parses comma and newline separated URLs", () => {
    expect(
      parseAppDirectoryUrls(
        "https://a.example/v2/apps, https://b.example/v2/apps\nhttps://c.example/v2/apps"
      )
    ).toEqual([
      "https://a.example/v2/apps",
      "https://b.example/v2/apps",
      "https://c.example/v2/apps",
    ])
  })

  it("deduplicates configured URLs", () => {
    expect(
      parseAppDirectoryUrls([
        "https://a.example/v2/apps",
        "https://a.example/v2/apps",
        " https://b.example/v2/apps ",
      ])
    ).toEqual(["https://a.example/v2/apps", "https://b.example/v2/apps"])
  })

  it("ignores unsupported values", () => {
    expect(parseAppDirectoryUrls(undefined)).toEqual([])
    expect(parseAppDirectoryUrls({ value: "https://example.com/v2/apps" })).toEqual([])
  })
})
