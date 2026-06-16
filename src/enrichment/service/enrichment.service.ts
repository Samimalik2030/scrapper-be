import { Injectable, Logger } from '@nestjs/common';
import { Configuration } from 'crawlee';
import { crawlWebsite } from 'src/crawlers/business.crawler';
import { extractEmails } from 'src/extractors/email.extractor';
import { extractPhones } from 'src/extractors/phone.extractor';
import { extractSocial } from 'src/extractors/social.extractor';
import { extractFounders } from 'src/extractors/founders.extractor';

@Injectable()
export class EnrichmentService {
  private readonly logger = new Logger(EnrichmentService.name);

  async enrich(url: string, config?: Configuration) {
    const enrichStart = Date.now();
    this.logger.log(`[START] enrich url=${url}`);

    let pages: Awaited<ReturnType<typeof crawlWebsite>>;
    try {
      this.logger.log(`[CRAWL] crawlWebsite starting url=${url}`);
      const crawlStart = Date.now();
      pages = await crawlWebsite(url, config);
      const crawlElapsed = Date.now() - crawlStart;
      this.logger.log(
        `[CRAWL] crawlWebsite done url=${url} pages=${pages.length} elapsed=${crawlElapsed}ms`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      this.logger.error(`[CRAWL] crawlWebsite THREW url=${url} error=${message}`, stack);
      throw err;
    }

    if (pages.length === 0) {
      this.logger.warn(`[CRAWL] Zero pages crawled for url=${url} — extractor output will be empty`);
    }

    for (const page of pages) {
      this.logger.log(
        `[PAGE] url=${page.url} ` +
        `htmlLen=${page.html.length} textLen=${page.text.length} ` +
        `links=${page.links.length} mailto=${page.mailtoLinks.length} ` +
        `tel=${page.telLinks.length} jsonLd=${page.jsonLd.length}`,
      );
    }

    this.logger.log(`[EXTRACT] Running all extractors for url=${url}`);
    const extractStart = Date.now();

    let emails: string[], phones: string[];
    let social: Awaited<ReturnType<typeof extractSocial>>;
    let founders: Awaited<ReturnType<typeof extractFounders>>;

    try {
      [emails, phones, social, founders] = await Promise.all([
        Promise.resolve(extractEmails(pages)),
        Promise.resolve(extractPhones(pages)),
        Promise.resolve(extractSocial(pages)),
        Promise.resolve(extractFounders(pages)),
      ]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      this.logger.error(`[EXTRACT] Extractor THREW url=${url} error=${message}`, stack);
      throw err;
    }

    const extractElapsed = Date.now() - extractStart;
    this.logger.log(
      `[EXTRACT] Done url=${url} elapsed=${extractElapsed}ms ` +
      `emails=${emails.length} phones=${phones.length} founders=${founders.length} ` +
      `fb=${social.facebooks.length} ig=${social.instagrams.length} ` +
      `li=${social.linkedIns.length} tw=${social.twitters.length} ` +
      `yt=${social.youtubes.length} tiktok=${social.tiktoks.length}`,
    );

    const totalElapsed = Date.now() - enrichStart;
    this.logger.log(`[DONE] enrich url=${url} totalElapsed=${totalElapsed}ms pagesCrawled=${pages.length}`);

    return {
      url,
      emails,
      phones,
      social,
      founders,
      pagesCrawled: pages.length,
    };
  }
}
