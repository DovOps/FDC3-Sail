/**

 * Migration guard: production code must not import AppDirectoryManager after collapse.

 */

import { readFileSync, readdirSync, statSync } from "node:fs"

import { join, relative } from "node:path"

import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vite-plus/test"

const packageRoot = fileURLToPath(new URL("../../../..", import.meta.url))

const srcRoot = join(packageRoot, "src")

function collectSourceFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)

    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") {
        continue
      }

      collectSourceFiles(fullPath, files)

      continue
    }

    if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) {
      files.push(fullPath)
    }
  }

  return files
}

describe("AppDirectoryManager removal guard", () => {
  it("has no production imports of AppDirectoryManager", () => {
    const offenders: string[] = []

    for (const filePath of collectSourceFiles(srcRoot)) {
      const rel = relative(srcRoot, filePath).replace(/\\/g, "/")

      const source = readFileSync(filePath, "utf8")

      if (source.includes("AppDirectoryManager") || source.includes("app-directory-manager")) {
        offenders.push(rel)
      }
    }

    expect(offenders).toEqual([])
  })
})
