import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { registry } from "./actors";

const app = new Hono();

// Mount Rivet actors at /api/rivet
app.all("/api/rivet/*", (c) => registry.handler(c.req.raw));

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

const port = Number(process.env.PORT) || 3000;

console.log(`Server starting on port ${port}`);
console.log(`Rivet metadata: http://localhost:${port}/api/rivet/metadata`);

serve({ fetch: app.fetch, port });
