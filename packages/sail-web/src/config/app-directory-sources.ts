declare global {
  interface Window {
    __SAIL_APP_DIRECTORY_URLS__?: string | string[]
  }
}

export function parseAppDirectoryUrls(value: unknown): string[] {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,\n]/)
      : []
  const urls = rawValues.map(entry => String(entry).trim()).filter(entry => entry.length > 0)

  return Array.from(new Set(urls))
}

export function getConfiguredAppDirectoryUrls(): string[] {
  return Array.from(
    new Set([
      ...parseAppDirectoryUrls(import.meta.env.VITE_SAIL_APP_DIRECTORY_URLS),
      ...parseAppDirectoryUrls(window.__SAIL_APP_DIRECTORY_URLS__),
    ])
  )
}
