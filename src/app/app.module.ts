import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EnrichmentModule } from 'src/enrichment/enrichment.module';

@Module({
  imports: [
    EnrichmentModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
