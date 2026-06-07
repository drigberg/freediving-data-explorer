import { defineConfig, type Connect } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "data");
const DATA_PATH = path.resolve(DATA_DIR, "data.json");
const LEGACY_DATA_PATH = path.resolve(DATA_DIR, "dives.json");

const EMPTY_STORE = JSON.stringify({ dives: [], tags: [] }, null, 2);

function ensureDataDir(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function divesApiPlugin() {
  const handler = async (
    req: Connect.IncomingMessage,
    res: ServerResponse,
    next: Connect.NextFunction
  ) => {
    if (!req.url?.startsWith("/api/dives")) {
      next();
      return;
    }

    if (req.method === "GET") {
      try {
        let content: string;
        if (fs.existsSync(DATA_PATH)) {
          content = fs.readFileSync(DATA_PATH, "utf-8");
        } else if (fs.existsSync(LEGACY_DATA_PATH)) {
          content = fs.readFileSync(LEGACY_DATA_PATH, "utf-8");
        } else {
          ensureDataDir();
          fs.writeFileSync(DATA_PATH, EMPTY_STORE);
          content = EMPTY_STORE;
        }
        res.setHeader("Content-Type", "application/json");
        res.statusCode = 200;
        res.end(content);
      } catch (err) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: String(err) }));
      }
      return;
    }

    if (req.method === "PUT") {
      try {
        const body = await readBody(req);
        JSON.parse(body);
        ensureDataDir();
        fs.writeFileSync(DATA_PATH, body);
        res.statusCode = 200;
        res.end(body);
      } catch (err) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: String(err) }));
      }
      return;
    }

    res.statusCode = 405;
    res.end();
  };

  return {
    name: "dives-api",
    configureServer(server: { middlewares: Connect.Server }) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server: { middlewares: Connect.Server }) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig({
  plugins: [react(), divesApiPlugin()],
});
