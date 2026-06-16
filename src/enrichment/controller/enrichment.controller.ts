import { Controller, Get, Post, Body } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiOkResponse,
  ApiExtraModels,
} from '@nestjs/swagger';
import { EnrichmentService } from '../service/enrichment.service';
import { EnrichDto } from '../dto/enrich.dto';
import {
  EnrichBatchPayloadDto,
  EnrichResultEventDto,
  EnrichErrorEventDto,
  EnrichProgressEventDto,
  EnrichCompleteEventDto,
  EnrichedResultDto,
  SocialHandlesDto,
  FounderDto,
  SocketEventsCatalogDto,
} from '../dto/socket-events.dto';

@ApiTags('enrichment')
@ApiExtraModels(
  SocialHandlesDto,
  FounderDto,
  EnrichedResultDto,
  EnrichBatchPayloadDto,
  EnrichResultEventDto,
  EnrichErrorEventDto,
  EnrichProgressEventDto,
  EnrichCompleteEventDto,
)
@Controller('enrichment')
export class EnrichmentController {
  constructor(private readonly enrichmentService: EnrichmentService) {}

  @Post()
  @ApiOperation({
    summary: 'Enrich a website (HTTP)',
    description:
      'Crawls the given website and returns the full enriched result synchronously. ' +
      'For batch processing of many URLs use the WebSocket gateway instead.',
  })
  @ApiBody({ type: EnrichDto })
  @ApiOkResponse({ type: EnrichedResultDto })
  async enrich(@Body() body: EnrichDto) {
    return this.enrichmentService.enrich(body.website);
  }

  @Get('socket-events')
  @ApiOperation({
    summary: 'WebSocket event catalog',
    description:
      'Returns the full Socket.IO event contract for the enrichment gateway. ' +
      'Connect to **ws://&lt;host&gt;:4000** using Socket.IO v4 and emit **enrich:batch** ' +
      'to start a batch job. Results stream back in real time as each URL finishes. ' +
      'Up to 4 URLs are processed concurrently; hundreds of URLs are supported.',
  })
  @ApiOkResponse({
    description:
      'Complete event catalog with payload schemas for all Socket.IO events.',
    type: SocketEventsCatalogDto,
  })
  socketDocs(): SocketEventsCatalogDto {
    return {
      url: 'ws://<host>:4000',
      transport: 'Socket.IO v4',
      events: [
        {
          event: 'enrich:batch',
          direction: 'client → server',
          description:
            'Submit a batch of URLs to enrich. Triggers streaming results.',
        },
        {
          event: 'enrich:result',
          direction: 'server → client',
          description:
            'Emitted once per successfully enriched URL, immediately when it finishes.',
        },
        {
          event: 'enrich:error',
          direction: 'server → client',
          description:
            'Emitted when a single URL fails. The batch continues processing remaining URLs.',
        },
        {
          event: 'enrich:progress',
          direction: 'server → client',
          description:
            'Emitted after every result or error with a running completed/total count.',
        },
        {
          event: 'enrich:complete',
          direction: 'server → client',
          description:
            'Emitted once when all URLs in the batch have been processed.',
        },
      ],
      inbound_enrich_batch: {
        batchId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        urls: ['https://aestheticsconsults.com.au', 'https://example.com'],
      },
      outbound_enrich_result: {
        batchId: 'a1b2c3d4-...',
        url: 'https://example.com',
        data: {
          url: 'https://example.com',
          emails: ['contact@example.com'],
          phones: ['+61 285264838'],
          social: {
            facebooks: ['https://facebook.com/AestheticsConsults'],
            instagrams: ['https://instagram.com/aesthetics_consults'],
            linkedIns: [],
            twitters: [],
            youtubes: [],
            tiktoks: [],
            pinterests: [],
            discords: [],
          },
          founders: [{ name: 'Dr Sana Pirzada', title: 'Director', source: 'text' }],
          pagesCrawled: 4,
        },
      },
      outbound_enrich_error: {
        batchId: 'a1b2c3d4-...',
        url: 'https://unreachable.example.com',
        message: 'net::ERR_NAME_NOT_RESOLVED',
      },
      outbound_enrich_progress: {
        batchId: 'a1b2c3d4-...',
        completed: 12,
        total: 100,
      },
      outbound_enrich_complete: {
        batchId: 'a1b2c3d4-...',
        succeeded: 97,
        failed: 3,
        total: 100,
      },
    };
  }
}
