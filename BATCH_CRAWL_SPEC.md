# Batch Crawling Implementation Spec

## Problem

The current architecture spins up a **new `PlaywrightCrawler` instance (and a new browser process) for every single URL**. In the WebSocket gateway, 4 concurrent workers each do this independently. For a 100-URL batch that means up to 4 browser processes starting and stopping in sequence — expensive and slow.

**Goal:** Crawl an entire batch of URLs inside a single `PlaywrightCrawler` run, sharing one browser instance, then stream enrichment results back as each URL's pages finish.

---

## Current Architecture (what exists today)

```
src/
  crawlers/
    business.crawler.ts         ← crawlWebsite(url: string) → CrawledPage[]
  enrichment/
    service/enrichment.service.ts   ← enrich(url, config?) → EnrichedResultDto
    gateway/enrichment.gateway.ts   ← 4 workers × enrich(url) per URL
```

### `crawlWebsite` today
- Accepts **one URL**
- Creates a `new PlaywrightCrawler(...)` with `maxConcurrency: 1`
- Follows internal links matching `**/about*`, `**/contact*`, `**/team*`, `**/services*`
- Returns flat `CrawledPage[]` for that one site

### Gateway today
- Receives `enrich:batch { batchId, urls[] }` from client
- Spawns 4 JS workers that share an atomic cursor
- Each worker calls `enrichmentService.enrich(url)` → one full browser per URL

---

## What to Build

### 1. New crawler function — `crawlWebsites`

**File:** `src/crawlers/business.crawler.ts`

Add a new exported function (keep `crawlWebsite` unchanged for the HTTP single-URL endpoint):

```typescript
export async function crawlWebsites(
  urls: string[],
  concurrency = 8,
): Promise<Map<string, CrawledPage[]>>
```

#### How it works

- Creates **one** `PlaywrightCrawler` with `maxConcurrency: concurrency`
- Seeds all root URLs at once via `crawler.run(urls)`
- Each initial request carries its root URL in `userData.rootUrl`
- In `requestHandler`, determine `rootUrl`:
  - From `request.userData.rootUrl` if set (it's a root URL itself)
  - Otherwise from `request.userData.rootUrl` passed through by `enqueueLinks`
- Collect pages into a `Map<string, CrawledPage[]>` keyed by `rootUrl`
- **Critical:** Only follow links on the **same hostname** as the root URL to prevent cross-site contamination. Use `enqueueLinks` with a dynamic glob:
  ```typescript
  const { hostname } = new URL(request.userData.rootUrl);
  await enqueueLinks({
    globs: [
      `**://${hostname}/about*`,
      `**://${hostname}/contact*`,
      `**://${hostname}/team*`,
      `**://${hostname}/services*`,
    ],
    userData: { rootUrl: request.userData.rootUrl },
  });
  ```
- Keep `maxRequestsPerCrawl` at **10 per root URL** — enforce this by tracking a per-root page count in a `Map<string, number>` inside the closure; skip `enqueueLinks` once the count reaches 10.
- Use a single shared `Configuration` with `persistStorage: false` and a fresh `randomUUID()` as `defaultRequestQueueId`.

#### Return value

After `crawler.run()` resolves, return the `Map<string, CrawledPage[]>`. Every URL passed in should have an entry (possibly empty if the site was unreachable, though Crawlee will have already retried by default).

---

### 2. New service method — `enrichBatch`

**File:** `src/enrichment/service/enrichment.service.ts`

Add alongside the existing `enrich()`:

```typescript
async enrichBatch(
  urls: string[],
  onResult: (url: string, result: EnrichedResultDto | null, error?: string) => void,
  concurrency = 8,
): Promise<void>
```

#### Steps

1. Call `crawlWebsites(urls, concurrency)` → `Map<string, CrawledPage[]>`
2. For each entry in the map, run the extractor pipeline (same as `enrich` today) in a `Promise.all` so all URLs process their extractors in parallel after the crawl:
   ```typescript
   await Promise.all(
     [...pagesMap.entries()].map(async ([url, pages]) => {
       try {
         const [emails, phones, social, founders] = await Promise.all([...]);
         onResult(url, { url, emails, phones, social, founders, pagesCrawled: pages.length });
       } catch (err) {
         onResult(url, null, err instanceof Error ? err.message : 'Unknown error');
       }
     }),
   );
   ```
3. `onResult` is called once per URL as soon as its extractors finish — this is how results stream to the WebSocket client without waiting for the full batch.

> Keep `enrich(url, config?)` exactly as-is — it is used by `POST /enrichment` and should not change.

---

### 3. Update the gateway

**File:** `src/enrichment/gateway/enrichment.gateway.ts`

Replace the worker-pool pattern with a single `enrichBatch` call:

```typescript
@SubscribeMessage('enrich:batch')
async handleBatch(
  @MessageBody() payload: EnrichBatchPayload,
  @ConnectedSocket() client: Socket,
): Promise<void> {
  const { batchId, urls } = payload;

  if (!Array.isArray(urls) || urls.length === 0) {
    client.emit('enrich:error', { batchId, url: '', message: 'urls must be a non-empty array' });
    return;
  }

  const state: ClientState = { cancelled: false };
  this.clientStates.set(client.id, state);

  const total = urls.length;
  let completed = 0;
  let succeeded = 0;
  let failed = 0;

  await this.enrichmentService.enrichBatch(
    urls,
    (url, data, errorMessage) => {
      if (state.cancelled) return;

      if (data) {
        client.emit('enrich:result', { batchId, url, data });
        succeeded += 1;
      } else {
        client.emit('enrich:error', { batchId, url, message: errorMessage });
        failed += 1;
      }

      completed += 1;
      client.emit('enrich:progress', { batchId, completed, total });
    },
  );

  if (!state.cancelled) {
    this.clientStates.delete(client.id);
    client.emit('enrich:complete', { batchId, succeeded, failed, total });
  }
}
```

Remove the `CONCURRENCY` constant and the `Configuration`/`randomUUID` imports from the gateway — they are no longer needed here.

---

## Files to Touch

| File | Change |
|---|---|
| `src/crawlers/business.crawler.ts` | Add `crawlWebsites(urls, concurrency)` |
| `src/enrichment/service/enrichment.service.ts` | Add `enrichBatch(urls, onResult, concurrency)` |
| `src/enrichment/gateway/enrichment.gateway.ts` | Replace worker-pool with `enrichBatch` call |

**Do not touch:**
- `src/enrichment/controller/enrichment.controller.ts` — HTTP single-URL path unchanged
- Any extractor files — no changes needed
- Any DTO files — response shapes are identical

---

## Concurrency Model

| Layer | Old | New |
|---|---|---|
| Browser processes | Up to 4 simultaneously | 1 shared instance |
| Pages in-flight | 4 (one per worker) | `concurrency` (default 8) |
| Crawler instances | 1 per URL | 1 per batch |
| Extractor parallelism | Sequential (one URL done before next) | All URLs' extractors run in parallel after crawl |

The default `concurrency = 8` means up to 8 pages are open simultaneously across all root URLs in the batch. Tune this based on available memory.

---

## Edge Cases to Handle

1. **URL not reached / timeout** — `CrawledPage[]` for that key will be empty; `enrichBatch` should still call `onResult` with a meaningful error rather than silently skipping.
2. **Duplicate URLs in payload** — deduplicate before passing to `crawlWebsites` to avoid double-counting in the per-root page cap.
3. **`state.cancelled`** — check it inside the `onResult` callback (already shown above) so a disconnect stops emitting immediately.
4. **Per-root page cap** — must be enforced inside `crawlWebsites` via a counter map, not via Crawlee's `maxRequestsPerCrawl` (which is a global limit across all root URLs).
