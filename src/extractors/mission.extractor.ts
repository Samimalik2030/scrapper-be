import { CrawledPage } from 'src/crawlers/business.crawler';

export interface MissionVision {
  mission: string | null;
  vision: string | null;
  description: string | null;
}

/** Extract text in a window after a heading keyword */
function textAfterHeading(text: string, keyword: RegExp): string | null {
  const match = keyword.exec(text);
  if (!match) return null;
  const after = text.slice(match.index + match[0].length).trimStart();
  // Take up to the next double-newline or 500 chars, whichever comes first
  const end = after.search(/\n{2,}|\r\n\r\n/);
  const snippet = end !== -1 ? after.slice(0, end) : after.slice(0, 500);
  return snippet.replace(/\s+/g, ' ').trim() || null;
}

export function extractMissionVision(pages: CrawledPage[]): MissionVision {
  // 1. Open Graph / JSON-LD description from home or about page
  const allPages = [...pages].sort(p =>
    /about|mission|vision/i.test(p.url) ? -1 : 1,
  );

  let description: string | null = null;
  for (const page of allPages) {
    const og = page.openGraph['description'] ?? page.openGraph['og:description'];
    if (og) { description = og; break; }
    for (const node of page.jsonLd) {
      if (!node || typeof node !== 'object') continue;
      const obj = node as Record<string, unknown>;
      const desc = obj['description'];
      if (typeof desc === 'string' && desc.trim()) {
        description = desc.trim();
        break;
      }
    }
    if (description) break;
  }

  // 2. Heuristic text search on about/mission pages
  const relevant = pages.filter(p => /about|mission|vision|values/i.test(p.url));
  const pool = relevant.length ? relevant : pages;

  let mission: string | null = null;
  let vision: string | null = null;

  for (const page of pool) {
    if (!mission) {
      mission =
        textAfterHeading(page.text, /our\s+mission\s*[:\n]/i) ??
        textAfterHeading(page.text, /mission\s+statement\s*[:\n]/i) ??
        textAfterHeading(page.text, /^mission\s*$/im);
    }
    if (!vision) {
      vision =
        textAfterHeading(page.text, /our\s+vision\s*[:\n]/i) ??
        textAfterHeading(page.text, /vision\s+statement\s*[:\n]/i) ??
        textAfterHeading(page.text, /^vision\s*$/im);
    }
    if (mission && vision) break;
  }

  return { mission, vision, description };
}
