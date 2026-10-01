import { createServer } from "node:http";
import { z } from "zod";
import { diagnosticKey, shouldPublish, type BuildEvent } from "./domain.js";
import { infrai } from "./infrai.js";

const eventSchema = z.object({
  tenantId: z.string().min(1).max(80),
  buildId: z.string().min(1).max(120),
  status: z.enum(["passed", "failed"]),
  diagnostics: z.array(z.string().min(1)).max(50)
});

const bucketFor = (tenantId: string) => `tenant-${tenantId.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;

async function ensureBucket(bucket: string): Promise<void> {
  await infrai.storage.bucket.create({ name: bucket }).catch((error: Error) => {
    if (!error.message.toLowerCase().includes("already")) throw error;
  });
}

async function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/build-events") {
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not found" }));
    return;
  }
  try {
    const event = eventSchema.parse(await readJson(request)) as BuildEvent;
    const bucket = bucketFor(event.tenantId);
    await ensureBucket(bucket);
    const key = diagnosticKey(event);
    const signed = await infrai.storage.object.presign(bucket, key, {
      op: "put",
      expires_seconds: 300,
      content_type: "application/json",
      idempotency_key: `${event.tenantId}:${event.buildId}`
    });
    const upload = await fetch(signed.url, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ buildId: event.buildId, diagnostics: event.diagnostics })
    });
    if (!upload.ok) throw new Error("diagnostic upload rejected");
    response.writeHead(201, { "content-type": "application/json" });
    response.end(JSON.stringify({ bucket, key, publish: shouldPublish(event) }));
  } catch (error) {
    const message = error instanceof z.ZodError ? "invalid request body" : (error as Error).message;
    response.writeHead(error instanceof z.ZodError ? 400 : 502, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: message }));
  }
});

server.listen(Number(process.env.PORT ?? 3000), () => {
  console.log("build event service listening on http://localhost:" + (process.env.PORT ?? 3000));
});
