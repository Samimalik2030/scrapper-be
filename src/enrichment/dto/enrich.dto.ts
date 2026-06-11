import { ApiProperty } from '@nestjs/swagger';

export class EnrichDto {
  @ApiProperty({
    description: 'The website URL to enrich',
    example: 'https://example.com',
  })
  website: string;
}
