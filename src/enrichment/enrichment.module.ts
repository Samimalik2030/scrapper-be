import { Module } from '@nestjs/common';
import { EnrichmentService } from './service/enrichment.service';
import { EnrichmentController } from './controller/enrichment.controller';
import { EnrichmentGateway } from './gateway/enrichment.gateway';

@Module({
  providers: [EnrichmentService, EnrichmentGateway],
  controllers: [EnrichmentController],
})
export class EnrichmentModule {}
