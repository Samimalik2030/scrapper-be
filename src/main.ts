import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app/app.module';

async function bootstrap() {
  // Must be set before any Crawlee crawler.run() call so the AutoscaledPool
  // Snapshotter uses the real EC2 memory rather than the cgroup-reported 227 MB.
  // Crawlee reads this lazily (per crawl run), so setting it here is early enough.
  // Override via system env if you need a different value (e.g. after an EC2 upgrade).
  if (!process.env.CRAWLEE_MEMORY_MBYTES) {
    process.env.CRAWLEE_MEMORY_MBYTES = '3000';
  }

  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('Scrapper API')
    .setDescription('API for crawling and enriching website data')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 5000);
}
bootstrap();
