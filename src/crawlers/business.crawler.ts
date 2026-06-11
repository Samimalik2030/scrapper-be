import { PlaywrightCrawler, parseOpenGraph, Configuration } from 'crawlee';
import { randomUUID } from 'node:crypto';

export interface CrawledPage {
  url: string;
  /** Rendered visible text only — no <script>/<style> content */
  text: string;
  /** Raw HTML — used for Open Graph and social handle parsing */
  html: string;
  links: string[];
  mailtoLinks: string[];
  telLinks: string[];
  jsonLd: unknown[];
  openGraph: Record<string, string>;
}

export async function crawlWebsite(url: string, config?: Configuration): Promise<CrawledPage[]> {
  const pages: CrawledPage[] = [];

  const crawlConfig = config ?? new Configuration({
    defaultRequestQueueId: randomUUID(),
    persistStorage: false,
    purgeOnStart: false,
  });

  const crawler = new PlaywrightCrawler({
    maxRequestsPerCrawl: 10,
    maxConcurrency: 1,
    minConcurrency: 1,

    async requestHandler({ page, request, enqueueLinks }) {
      const hrefs = await page.$$eval('a[href]', els =>
        els.map(el => el.getAttribute('href') ?? '').filter(Boolean),
      );

      const [html, text, jsonLd] = await Promise.all([
        page.content(),
        page.evaluate(() => document.body.innerText),
        page.$$eval('script[type="application/ld+json"]', els =>
          els.flatMap(el => {
            try {
              return [JSON.parse(el.textContent ?? '')];
            } catch {
              return [];
            }
          }),
        ),
      ]);

      pages.push({
        url: request.url,
        text,
        html,
        links: hrefs.filter(h => h.startsWith('http')),
        mailtoLinks: hrefs.filter(h => h.startsWith('mailto:')),
        telLinks: hrefs.filter(h => h.startsWith('tel:')),
        jsonLd,
        openGraph: parseOpenGraph(html) as Record<string, string>,
      });

      await enqueueLinks({
        globs: ['**/about*', '**/contact*', '**/team*', '**/services*'],
      });
    },
  }, crawlConfig);

  await crawler.run([url]);
  return pages;
}
