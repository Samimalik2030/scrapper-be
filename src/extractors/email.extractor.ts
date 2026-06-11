import { social } from 'crawlee';
import { CrawledPage } from 'src/crawlers/business.crawler';

export function extractEmails(pages: CrawledPage[]): string[] {
  const found: string[] = [];
  for (const page of pages) {
    found.push(...social.emailsFromUrls(page.mailtoLinks));
    found.push(...social.emailsFromText(page.text));
  }
  return [...new Set(found)];
}
