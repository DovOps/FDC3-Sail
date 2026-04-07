import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadPolygonApiKey(): string {
  const fromEnv = process.env.POLYGON_API_KEY
  if (fromEnv) return fromEnv

  const propsPath = path.resolve(__dirname, "..", "properties.json")
  if (fs.existsSync(propsPath)) {
    try {
      const props = JSON.parse(fs.readFileSync(propsPath, "utf-8")) as {
        polygonApiKey?: string
      }
      if (props.polygonApiKey) return props.polygonApiKey
    } catch {
      /* ignore */
    }
  }

  return "no-key"
}

const polygonApiKey = loadPolygonApiKey()

export default function (app: any) {
  app.get("/polygon-key", (_req: any, res: any) => {
    res.json({ key: polygonApiKey })
  })
}
