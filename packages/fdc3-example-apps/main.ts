import express from 'express';
import http from 'http';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const BASE_PORT = 4010;

/**
 * Discovery utility for both front-end and server apps.
 */
function discoverApps(baseDir: string) {
  if (!fs.existsSync(baseDir)) return [];
  return fs
    .readdirSync(baseDir, { withFileTypes: true })
    .filter(dirent => {
      const appPath = path.join(baseDir, dirent.name);
      return (
        dirent.isDirectory() &&
        dirent.name !== 'node_modules' &&
        dirent.name !== 'dist' &&
        fs.existsSync(path.join(appPath, 'index.html'))
      );
    })
    .map(dirent => ({
      name: dirent.name,
      root: path.join(baseDir, dirent.name),
    }));
}

const frontEndAppsDir = path.resolve(process.cwd(), 'front-end-apps');
const serverAppsDir = path.resolve(process.cwd(), 'server-apps');


const allApps = [...discoverApps(frontEndAppsDir), ...discoverApps(serverAppsDir)].sort((a, b) =>
  a.name.localeCompare(b.name)
);

// Assign ports, respecting properties.json if present
const apps = allApps.map((a, index) => {
  let port = BASE_PORT + index;
  const propPath = path.join(a.root, 'properties.json');
  if (fs.existsSync(propPath)) {
    try {
      const props = JSON.parse(fs.readFileSync(propPath, 'utf-8'));
      if (props.port) {
        port = props.port;
      }
    } catch (e) {
      console.error(`Failed to read properties.json for ${a.name}`, e);
    }
  }
  return {
    ...a,
    port,
  };
});

async function startApp(appName: string, appRoot: string, port: number) {
  const app = express();
  app.use(express.json());

  // Load backend if exists (mostly used in server-apps). Receives the shared HTTP server
  // so WebSocket + JWKS can bind to the same port as Express + Vite.
  const backendPath = path.join(appRoot, 'src', 'backend.ts');
  const server = http.createServer(app);
  if (fs.existsSync(backendPath)) {
    try {
      const backendUrl = `file://${backendPath}`;
      const { default: backend } = await import(backendUrl);
      if (typeof backend === 'function') {
        const result = backend(app, server, { port, appRoot });
        if (result != null && typeof (result as Promise<void>).then === 'function') {
          await result;
        }
      }
    } catch (e) {
      console.error({ appName, error: e }, 'Failed to load backend extension');
    }
  }

  // Mount the app's static director at /static/appName to match the expected URL structure
  // and legacy patterns from the demo.
  const staticPath = path.join(appRoot, 'static');
  if (fs.existsSync(staticPath)) {
    app.use(express.static(staticPath));
  }

  // Each app gets its own isolated Vite server
  const vite = await createServer({
    root: appRoot,
    cacheDir: path.join(appRoot, '.vite'),
    server: {
      middlewareMode: true,
      hmr: {
        port: port + 100, // Avoid HMR port conflicts
      },
    },
    appType: 'spa',
    plugins: [react()],
  });

  app.use(vite.middlewares);

  // Serve index.html for unknown routes
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    const indexPath = path.join(appRoot, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      next();
    }
  });

  server.listen(port, () => {
    console.info({ appName, port, url: `http://localhost:${port}` }, 'Application server online');
  });
}

async function startAppDirectoryServer(apps: any[]) {
  const app = express();
  const PORT = 4040;

  // Basic CORS support
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
  });

  app.get('/appd.v2.json', (req, res) => {
    const combined = {
      applications: [] as any[],
      message: 'OK',
    };

    for (const a of apps) {
      const appdPath = path.join(a.root, 'static', 'appd.v2.json');
      if (fs.existsSync(appdPath)) {
        try {
          const content = JSON.parse(fs.readFileSync(appdPath, 'utf-8'));
          if (Array.isArray(content.applications)) {
            combined.applications.push(...content.applications);
          }
        } catch (e) {
          console.error(`Failed to read appd.v2.json for ${a.name}`, e);
        }
      }
    }

    res.json(combined);
  });

  app.listen(PORT, () => {
    console.info(
      { appName: 'AppDirectory', port: PORT, url: `http://localhost:${PORT}/appd.v2.json` },
      'App Directory server online'
    );
  });
}

(async () => {
  if (apps.length === 0) {
    console.warn('No apps found to start.');
    return;
  }
  console.log(`Starting ${apps.length} applications from ${frontEndAppsDir} and ${serverAppsDir}...`);

  // Start the apps
  for (const a of apps) {
    try {
      await startApp(a.name, a.root, a.port);
    } catch (err) {
      console.error({ appName: a.name, error: err }, 'Failed to start application server');
    }
  }

  // Start the combined directory server
  try {
    await startAppDirectoryServer(apps);
  } catch (err) {
    console.error({ error: err }, 'Failed to start App Directory server');
  }
})();
