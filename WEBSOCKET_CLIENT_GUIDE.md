# Enrichment WebSocket API — Client Integration Guide

## Connection

- **URL:** `ws://<host>:4000`
- **Transport:** Socket.IO v4

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000');
```

---

## Submit a Batch

Emit `enrich:batch` with a list of URLs to start processing.

```js
socket.emit('enrich:batch', {
  batchId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', // any unique string you generate
  urls: [
    'https://example.com',
    'https://another-site.com',
  ],
});
```

| Field | Type | Description |
|---|---|---|
| `batchId` | `string` | Caller-generated ID. Every response event echoes it back so you can correlate events to the right batch. |
| `urls` | `string[]` | List of root website URLs to enrich. Supports hundreds of entries. |

---

## Events to Listen For

### `enrich:result` — one URL succeeded

Emitted immediately when a single URL finishes enriching. Does not wait for the rest of the batch.

```js
socket.on('enrich:result', ({ batchId, url, data }) => {
  console.log(url, data);
});
```

**`data` shape:**

```ts
{
  url: string;
  emails: string[];
  phones: string[];
  social: {
    facebooks: string[];
    instagrams: string[];
    linkedIns: string[];
    twitters: string[];
    youtubes: string[];
    tiktoks: string[];
    pinterests: string[];
    discords: string[];
  };
  founders: Array<{
    name: string;
    title: string;
    source: 'json-ld' | 'text';
  }>;
  pagesCrawled: number;
}
```

---

### `enrich:error` — one URL failed

Emitted when a single URL fails. The batch continues processing remaining URLs.

```js
socket.on('enrich:error', ({ batchId, url, message }) => {
  console.error(`Failed: ${url} — ${message}`);
});
```

| Field | Type |
|---|---|
| `batchId` | `string` |
| `url` | `string` |
| `message` | `string` — human-readable error (e.g. `net::ERR_NAME_NOT_RESOLVED`) |

---

### `enrich:progress` — running count

Emitted after every result or error with the current progress.

```js
socket.on('enrich:progress', ({ batchId, completed, total }) => {
  console.log(`${completed} / ${total}`);
});
```

| Field | Type |
|---|---|
| `batchId` | `string` |
| `completed` | `number` — URLs resolved so far (success + error) |
| `total` | `number` — total URLs in the batch |

---

### `enrich:complete` — batch finished

Emitted once when every URL in the batch has been processed.

```js
socket.on('enrich:complete', ({ batchId, succeeded, failed, total }) => {
  console.log(`Done — ${succeeded} ok, ${failed} failed out of ${total}`);
});
```

| Field | Type |
|---|---|
| `batchId` | `string` |
| `succeeded` | `number` |
| `failed` | `number` |
| `total` | `number` |

---

## Full Example

```js
import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

const socket = io('http://localhost:4000');
const batchId = uuidv4();

const urls = [
  'https://example.com',
  'https://another-site.com',
];

socket.emit('enrich:batch', { batchId, urls });

socket.on('enrich:result', ({ url, data }) => {
  // handle enriched result for one URL
});

socket.on('enrich:error', ({ url, message }) => {
  // handle failure for one URL — batch is still running
});

socket.on('enrich:progress', ({ completed, total }) => {
  // update a progress bar
});

socket.on('enrich:complete', ({ succeeded, failed, total }) => {
  socket.disconnect();
});
```

---

## Notes

- Results arrive **out of order** — a fast site returns before a slow one regardless of submission order. Use `url` on each event to identify which site the result belongs to.
- If you disconnect mid-batch the server stops emitting for your session immediately.
- Up to 4 URLs are processed concurrently on the server side.
