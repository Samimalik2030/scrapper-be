import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { Configuration } from 'crawlee';
import { randomUUID } from 'node:crypto';
import { EnrichmentService } from '../service/enrichment.service';

interface EnrichBatchPayload {
  batchId: string;
  urls: string[];
}

interface ClientState {
  cancelled: boolean;
}

const CONCURRENCY = 4;

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class EnrichmentGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  private readonly server!: Server;

  private readonly logger = new Logger(EnrichmentGateway.name);
  private readonly clientStates = new Map<string, ClientState>();

  constructor(private readonly enrichmentService: EnrichmentService) {}

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
    const state = this.clientStates.get(client.id);
    if (state) {
      state.cancelled = true;
      this.clientStates.delete(client.id);
    }
  }

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

    this.logger.log(`Batch ${batchId}: ${urls.length} URLs from client ${client.id}`);

    const state: ClientState = { cancelled: false };
    this.clientStates.set(client.id, state);

    const total = urls.length;
    let cursor = 0;
    let completed = 0;
    let succeeded = 0;
    let failed = 0;

    // Worker-pool with shared cursor — JS single-thread guarantees atomic
    // increment before any await, so no two workers claim the same index.
    const worker = async (): Promise<void> => {
      while (true) {
        if (state.cancelled) return;

        const index = cursor;
        if (index >= total) return;
        cursor += 1;

        const url = urls[index];
        const crawlConfig = new Configuration({
          defaultRequestQueueId: randomUUID(),
          persistStorage: false,
          purgeOnStart: false,
        });

        try {
          const data = await this.enrichmentService.enrich(url, crawlConfig);
          if (!state.cancelled) {
            client.emit('enrich:result', { batchId, url, data });
          }
          succeeded += 1;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          this.logger.warn(`Failed to enrich ${url}: ${message}`);
          if (!state.cancelled) {
            client.emit('enrich:error', { batchId, url, message });
          }
          failed += 1;
        }

        completed += 1;
        if (!state.cancelled) {
          client.emit('enrich:progress', { batchId, completed, total });
        }
      }
    };

    const workerCount = Math.min(CONCURRENCY, total);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));

    if (!state.cancelled) {
      this.clientStates.delete(client.id);
      client.emit('enrich:complete', { batchId, succeeded, failed, total });
      this.logger.log(`Batch ${batchId} complete — ${succeeded} ok, ${failed} failed`);
    }
  }
}
