import { Injectable } from '@nestjs/common';
import { Configuration } from 'crawlee';
import { crawlWebsite } from 'src/crawlers/business.crawler';
import { extractEmails } from 'src/extractors/email.extractor';
import { extractPhones } from 'src/extractors/phone.extractor';
import { extractSocial } from 'src/extractors/social.extractor';
import { extractFounders } from 'src/extractors/founders.extractor';
import { extractMissionVision } from 'src/extractors/mission.extractor';

@Injectable()
export class EnrichmentService {
  async enrich(url: string, config?: Configuration) {
    const pages = await crawlWebsite(url, config);

    const [emails, phones, social, founders, missionVision] = await Promise.all([
      Promise.resolve(extractEmails(pages)),
      Promise.resolve(extractPhones(pages)),
      Promise.resolve(extractSocial(pages)),
      Promise.resolve(extractFounders(pages)),
      Promise.resolve(extractMissionVision(pages)),
    ]);

    return {
      url,
      emails,
      phones,
      social,
      founders,
      mission: missionVision.mission,
      vision: missionVision.vision,
      description: missionVision.description,
      pagesCrawled: pages.length,
    };
  }
}
