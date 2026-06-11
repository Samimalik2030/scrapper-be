import { social } from 'crawlee';
import { CrawledPage } from 'src/crawlers/business.crawler';

export function extractPhones(pages: CrawledPage[]): string[] {
  const found: string[] = [];
  for (const page of pages) {
    // tel: hrefs are more accurate than text regex for formatted numbers
    found.push(...social.phonesFromUrls(page.telLinks));
    found.push(...social.phonesFromText(page.text));
  }
  return [...new Set(found)];
}
