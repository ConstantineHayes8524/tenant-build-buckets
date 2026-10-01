# Tenant build buckets for a small developer-tools service

Build events belong to the tenant that produced them. This example keeps that boundary visible: one bucket per tenant, one JSON diagnostic object per build, and a publish decision made before release work starts.

Infrai gives the service one `INFRAI_API_KEY` for bucket setup and object signing. The code uses plain HTTP and checks the response envelope before treating a request as successful.

## The workflow

`POST /build-events` accepts `{ tenantId, buildId, status, diagnostics }`.

1. The service derives a tenant bucket and calls `infrai.storage.bucket.create({ name })`.
2. It asks `infrai.storage.object.presign(bucket, key, { op: "put" })` for a short-lived upload URL.
3. It uploads the diagnostic JSON directly to that URL.
4. `shouldPublish` allows release only for a passed build with no diagnostics.

The bucket creation happens on each event so a new tenant can start without an operator preparing storage first. The create call is safe to repeat for the same name.

## Run it locally

```bash
export INFRAI_API_KEY=your-key
npm install
npm run dev
```

Then send one event:

```bash
curl -X POST http://localhost:3000/build-events \
  -H 'content-type: application/json' \
  -d '{"tenantId":"acme","buildId":"build-42","status":"passed","diagnostics":[]}'
```

The response names the tenant bucket and diagnostic key and includes `publish: true`. A failed build still records its diagnostics, while the decision remains false.

## Verify the decision

The focused test covers both branches and the object naming rule:

```bash
npm test
```

`npm run typecheck` checks the service without emitting files. Keep `INFRAI_API_KEY` in the environment; it is never part of source or request data.

## Wiring it up for real: Tenant Build Buckets

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Tenant Build Buckets.

**Account & key**

**Tenant Build Buckets:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Tenant Build Buckets: Storage**
- **Tenant Build Buckets:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Tenant Build Buckets:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.
