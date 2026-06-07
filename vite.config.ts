import { defineConfig, type Connect } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIVES_PATH = path.resolve(__dirname, "dives.json");

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
        if (!fs.existsSync(DIVES_PATH)) {
          fs.writeFileSync(
            DIVES_PATH,
            JSON.stringify({ dives: [], tags: [] }, null, 2)
          );
        }
        const content = fs.readFileSync(DIVES_PATH, "utf-8");
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
        fs.writeFileSync(DIVES_PATH, body);
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
