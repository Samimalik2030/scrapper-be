import { ApiProperty } from '@nestjs/swagger';

// ---------------------------------------------------------------------------
// Shared sub-shapes
// ---------------------------------------------------------------------------

export class SocialHandlesDto {
  @ApiProperty({ example: ['https://facebook.com/company'], type: [String] })
  facebooks: string[];

  @ApiProperty({ example: ['https://instagram.com/company'], type: [String] })
  instagrams: string[];

  @ApiProperty({ example: ['https://linkedin.com/company/name'], type: [String] })
  linkedIns: string[];

  @ApiProperty({ example: ['https://x.com/handle'], type: [String] })
  twitters: string[];

  @ApiProperty({ example: ['https://youtube.com/channel/UC123'], type: [String] })
  youtubes: string[];

  @ApiProperty({ example: [], type: [String] })
  tiktoks: string[];

  @ApiProperty({ example: [], type: [String] })
  pinterests: string[];

  @ApiProperty({ example: [], type: [String] })
  discords: string[];
}

export class FounderDto {
  @ApiProperty({ example: 'Dr Sana Pirzada' })
  name: string;

  @ApiProperty({ example: 'Director' })
  title: string;

  @ApiProperty({ enum: ['json-ld', 'text'], example: 'text' })
  source: 'json-ld' | 'text';
}

export class EnrichedResultDto {
  @ApiProperty({ example: 'https://example.com' })
  url: string;

  @ApiProperty({ example: ['contact@example.com'], type: [String] })
  emails: string[];

  @ApiProperty({ example: ['+61 285264838'], type: [String] })
  phones: string[];

  @ApiProperty({ type: SocialHandlesDto })
  social: SocialHandlesDto;

  @ApiProperty({ type: [FounderDto] })
  founders: FounderDto[];

  @ApiProperty({ example: 'We provide world-class aesthetic consultations.', nullable: true })
  mission: string | null;

  @ApiProperty({ example: 'To be the leading aesthetics consultancy in Australia.', nullable: true })
  vision: string | null;

  @ApiProperty({ example: 'Australia\'s most trusted aesthetics consultancy.', nullable: true })
  description: string | null;

  @ApiProperty({ example: 4 })
  pagesCrawled: number;
}

// ---------------------------------------------------------------------------
// Inbound event (Client → Server)
// ---------------------------------------------------------------------------

export class EnrichBatchPayloadDto {
  @ApiProperty({
    description: 'Caller-generated unique identifier for this batch. All response events carry the same batchId so the client can correlate them.',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  batchId: string;

  @ApiProperty({
    description: 'List of website URLs to enrich. Can contain hundreds of entries.',
    example: ['https://aestheticsconsults.com.au', 'https://example.com'],
    type: [String],
  })
  urls: string[];
}

// ---------------------------------------------------------------------------
// Outbound events (Server → Client)
// ---------------------------------------------------------------------------

export class EnrichResultEventDto {
  @ApiProperty({ description: 'Echoes the batchId from the request.', example: 'a1b2c3d4-...' })
  batchId: string;

  @ApiProperty({ description: 'The URL that was enriched.', example: 'https://example.com' })
  url: string;

  @ApiProperty({ description: 'Full enrichment result for this URL.', type: EnrichedResultDto })
  data: EnrichedResultDto;
}

export class EnrichErrorEventDto {
  @ApiProperty({ example: 'a1b2c3d4-...' })
  batchId: string;

  @ApiProperty({ description: 'The URL that failed.', example: 'https://unreachable.example.com' })
  url: string;

  @ApiProperty({ description: 'Human-readable error description.', example: 'net::ERR_NAME_NOT_RESOLVED' })
  message: string;
}

export class EnrichProgressEventDto {
  @ApiProperty({ example: 'a1b2c3d4-...' })
  batchId: string;

  @ApiProperty({ description: 'Number of URLs resolved so far (success + error combined).', example: 12 })
  completed: number;

  @ApiProperty({ description: 'Total number of URLs in the batch.', example: 100 })
  total: number;
}

export class EnrichCompleteEventDto {
  @ApiProperty({ example: 'a1b2c3d4-...' })
  batchId: string;

  @ApiProperty({ description: 'Number of URLs successfully enriched.', example: 97 })
  succeeded: number;

  @ApiProperty({ description: 'Number of URLs that raised an error.', example: 3 })
  failed: number;

  @ApiProperty({ description: 'Total URLs that were in the batch.', example: 100 })
  total: number;
}

// ---------------------------------------------------------------------------
// Catalog (returned by the documentation endpoint)
// ---------------------------------------------------------------------------

export class SocketEventDto {
  @ApiProperty({ description: 'Socket.IO event name.', example: 'enrich:result' })
  event: string;

  @ApiProperty({ description: 'Direction of the event.', enum: ['client → server', 'server → client'] })
  direction: string;

  @ApiProperty({ description: 'When this event is emitted.' })
  description: string;
}

export class SocketEventsCatalogDto {
  @ApiProperty({ description: 'WebSocket server URL.', example: 'ws://localhost:4000' })
  url: string;

  @ApiProperty({ description: 'Transport library.', example: 'Socket.IO v4' })
  transport: string;

  @ApiProperty({ type: [SocketEventDto] })
  events: SocketEventDto[];

  @ApiProperty({ type: EnrichBatchPayloadDto })
  inbound_enrich_batch: EnrichBatchPayloadDto;

  @ApiProperty({ type: EnrichResultEventDto })
  outbound_enrich_result: EnrichResultEventDto;

  @ApiProperty({ type: EnrichErrorEventDto })
  outbound_enrich_error: EnrichErrorEventDto;

  @ApiProperty({ type: EnrichProgressEventDto })
  outbound_enrich_progress: EnrichProgressEventDto;

  @ApiProperty({ type: EnrichCompleteEventDto })
  outbound_enrich_complete: EnrichCompleteEventDto;
}
