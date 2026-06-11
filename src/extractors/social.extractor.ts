import { social } from 'crawlee';
import { CrawledPage } from 'src/crawlers/business.crawler';

export interface SocialHandles {
  facebooks: string[];
  instagrams: string[];
  linkedIns: string[];
  twitters: string[];
  youtubes: string[];
  tiktoks: string[];
  pinterests: string[];
  discords: string[];
}

export function extractSocial(pages: CrawledPage[]): SocialHandles {
  const merged: SocialHandles = {
    facebooks: [],
    instagrams: [],
    linkedIns: [],
    twitters: [],
    youtubes: [],
    tiktoks: [],
    pinterests: [],
    discords: [],
  };

  for (const page of pages) {
    const handles = social.parseHandlesFromHtml(page.html);
    for (const key of Object.keys(merged) as (keyof SocialHandles)[]) {
      const values = handles[key as keyof typeof handles];
      if (Array.isArray(values)) {
        merged[key].push(...(values as string[]));
      }
    }
  }

  for (const key of Object.keys(merged) as (keyof SocialHandles)[]) {
    merged[key] = [...new Set(merged[key])];
  }

  return merged;
}
