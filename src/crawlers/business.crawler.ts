import { PlaywrightCrawler, parseOpenGraph, Configuration, log } from 'crawlee';
import { randomUUID } from 'node:crypto';
import * as os from 'node:os';

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
  const crawlStart = Date.now();

  // ── System snapshot ──────────────────────────────────────────────────────
  const totalMemMb = Math.round(os.totalmem() / 1024 / 1024);
  const freeMemMb  = Math.round(os.freemem()  / 1024 / 1024);
  const cpuCount   = os.cpus().length;
  const platform   = os.platform();
  const nodeVer    = process.version;
  const crawleeMemEnv = process.env.CRAWLEE_MEMORY_MBYTES ?? '(not set)';

  log.info(
    `[Crawler:Setup] System info — platform=${platform} node=${nodeVer} ` +
    `cpus=${cpuCount} totalMem=${totalMemMb}MB freeMem=${freeMemMb}MB ` +
    `CRAWLEE_MEMORY_MBYTES=${crawleeMemEnv}`,
  );

  log.info(`[Crawler:Setup] Config — external config provided=${config != null}`);

  log.info(`[Crawler] START url=${url}`);

  const crawlConfig = config ?? new Configuration({
    defaultRequestQueueId: randomUUID(),
    persistStorage: false,
    purgeOnStart: false,
  });

  log.info(
    `[Crawler:Setup] PlaywrightCrawler options — ` +
    `maxRequestsPerCrawl=10 maxConcurrency=1 minConcurrency=1 ` +
    `requestHandlerTimeoutSecs=60 navigationTimeoutSecs=30`,
  );

  log.info(
    `[Crawler:Setup] Chromium args — no-sandbox=true disable-dev-shm-usage=true ` +
    `disable-gpu=true disable-extensions=true disable-background-networking=true`,
  );

  const crawlerArgs = [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-default-apps',
    '--mute-audio',
    '--no-first-run',
  ];

  const crawler = new PlaywrightCrawler({
    maxRequestsPerCrawl: 10,
    maxConcurrency: 1,
    minConcurrency: 1,
    requestHandlerTimeoutSecs: 60,
    navigationTimeoutSecs: 30,

    launchContext: {
      launchOptions: {
        args: crawlerArgs,
      },
    },

    async requestHandler({ page, request, enqueueLinks }) {
      const reqStart = Date.now();
      log.info(`[Crawler] REQUEST_START url=${request.url} retry=${request.retryCount}`);

      log.info(`[Crawler] Collecting hrefs url=${request.url}`);
      const hrefs = await page.$$eval('a[href]', els =>
        els.map(el => el.getAttribute('href') ?? '').filter(Boolean),
      );
      log.info(`[Crawler] hrefs collected url=${request.url} total=${hrefs.length}`);

      log.info(`[Crawler] Fetching page content url=${request.url}`);
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

      const httpLinks = hrefs.filter(h => h.startsWith('http'));
      const mailtoLinks = hrefs.filter(h => h.startsWith('mailto:'));
      const telLinks = hrefs.filter(h => h.startsWith('tel:'));

      log.info(
        `[Crawler] Content ready url=${request.url} ` +
        `htmlLen=${html.length} textLen=${text.length} jsonLd=${jsonLd.length} ` +
        `httpLinks=${httpLinks.length} mailto=${mailtoLinks.length} tel=${telLinks.length}`,
      );

      pages.push({
        url: request.url,
        text,
        html,
        links: httpLinks,
        mailtoLinks,
        telLinks,
        jsonLd,
        openGraph: parseOpenGraph(html) as Record<string, string>,
      });

      log.info(`[Crawler] Enqueueing links url=${request.url}`);
      await enqueueLinks({
        globs: ['**/about*', '**/contact*', '**/team*', '**/services*'],
      });

      const reqElapsed = Date.now() - reqStart;
      log.info(
        `[Crawler] REQUEST_DONE url=${request.url} elapsed=${reqElapsed}ms pagesTotal=${pages.length}`,
      );
    },

    failedRequestHandler({ request, error }) {
      log.error(
        `[Crawler] REQUEST_FAILED url=${request.url} retry=${request.retryCount} ` +
        `error=${error instanceof Error ? error.message : String(error)}`,
      );
    },
  }, crawlConfig);

  log.info(`[Crawler:Setup] Crawler instance created — calling crawler.run() now url=${url}`);

  try {
    await crawler.run([url]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    log.error(`[Crawler:Setup] crawler.run() THREW url=${url} error=${msg} stack=${stack ?? ''}`);
    throw err;
  }

  const crawlElapsed = Date.now() - crawlStart;
  log.info(`[Crawler] DONE url=${url} totalPages=${pages.length} elapsed=${crawlElapsed}ms`);

  return pages;
}
