/**
 * Cucumber harness must seed catalog data via mutators or config.apps — not AppDirectoryManager.
 */

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vite-plus/test"

const testRoot = fileURLToPath(new URL("..", import.meta.url))

function readHarnessSource(relativePath: string): string {
  return readFileSync(join(testRoot, relativePath), "utf8")
}

describe("Cucumber world app directory seeding", () => {
  it("CustomWorld does not declare or construct AppDirectoryManager", () => {
    const worldSource = readHarnessSource("world/index.ts")
    expect(worldSource).not.toMatch(/\bAppDirectoryManager\b/)
    expect(worldSource).not.toMatch(/\bappDirectoryManager\b/)
  })

  it("dacp-handler-context does not pass world.appDirectoryManager into handler context", () => {
    const contextSource = readHarnessSource("support/dacp-handler-context.ts")
    expect(contextSource).not.toMatch(/\bappDirectoryManager\b/)
    expect(contextSource).not.toMatch(/\bAppDirectoryManager\b/)
  })
})
