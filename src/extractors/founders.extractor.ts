import { CrawledPage } from 'src/crawlers/business.crawler';

export interface Founder {
  name: string;
  title: string;
  source: 'json-ld' | 'text';
}

const TITLE_PATTERN =
  /(?:Director|Founder|Co-?Founder|CEO|CTO|COO|CFO|CMO|Managing Director|Principal|Partner|President|Owner|Head|Chief|VP|Vice[\s-]President)/i;

const NAME_LINE_REGEX = new RegExp(
  String.raw`((?:Dr|Mr|Mrs|Ms|Prof|Sir)\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*[-–—]\s*(${TITLE_PATTERN.source}[^\n]*)`,
  'gim',
);

function fromJsonLd(pages: CrawledPage[]): Founder[] {
  const founders: Founder[] = [];
  for (const page of pages) {
    for (const node of page.jsonLd) {
      const items = Array.isArray(node) ? node : [node];
      for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const obj = item as Record<string, unknown>;
        const type = String(obj['@type'] ?? '');
        if (/Person|Employee|Founder/i.test(type)) {
          const name = String(obj['name'] ?? '').trim();
          const title = String(obj['jobTitle'] ?? obj['description'] ?? '').trim();
          if (name) founders.push({ name, title, source: 'json-ld' });
        }
        // Organization.employee / Organization.founder arrays
        for (const prop of ['employee', 'founder', 'member']) {
          const list = obj[prop];
          if (!Array.isArray(list)) continue;
          for (const person of list) {
            if (!person || typeof person !== 'object') continue;
            const p = person as Record<string, unknown>;
            const name = String(p['name'] ?? '').trim();
            const title = String(p['jobTitle'] ?? p['description'] ?? '').trim();
            if (name) founders.push({ name, title, source: 'json-ld' });
          }
        }
      }
    }
  }
  return founders;
}

function fromText(pages: CrawledPage[]): Founder[] {
  const founders: Founder[] = [];
  // Prefer about/team pages for text heuristics
  const relevant = pages.filter(p => /about|team|staff|people/i.test(p.url));
  const source = relevant.length ? relevant : pages;

  for (const page of source) {
    let match: RegExpExecArray | null;
    const re = new RegExp(NAME_LINE_REGEX.source, NAME_LINE_REGEX.flags);
    while ((match = re.exec(page.text)) !== null) {
      const prefix = (match[1] ?? '').trim();
      const name = ((prefix ? prefix + ' ' : '') + match[2]).trim();
      const title = match[3].trim();
      founders.push({ name, title, source: 'text' });
    }
  }
  return founders;
}

export function extractFounders(pages: CrawledPage[]): Founder[] {
  const ldFounders = fromJsonLd(pages);
  if (ldFounders.length) return ldFounders;

  const textFounders = fromText(pages);
  // Deduplicate by name
  const seen = new Set<string>();
  return textFounders.filter(f => {
    const key = f.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
