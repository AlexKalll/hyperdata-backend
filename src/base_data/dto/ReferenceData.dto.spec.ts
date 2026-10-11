import { ArgumentMetadata, HttpException } from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import { CustomValidationPipe } from 'src/utils/CustomValidationPipe';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
} from './Organization.dto';
import { CreateZoneDto, UpdateZoneDto } from './Zone.dto';
import { Sector } from '../entities/Sector.entity';
import { SectorSanitized } from '../sanitize';

describe('reference-data DTO validation and sanitization', () => {
  describe.each([
    {
      name: 'organization create',
      metatype: CreateOrganizationDto,
      payload: {
        name: 'Example Organization',
        email: 'contact@example.com',
        phone: '+251900000000',
        address: 'Addis Ababa',
      },
    },
    {
      name: 'organization update',
      metatype: UpdateOrganizationDto,
      payload: { name: 'Renamed Organization' },
    },
    {
      name: 'zone create',
      metatype: CreateZoneDto,
      payload: {
        name: 'Addis Zone',
        region_id: '00000000-0000-0000-0000-000000000001',
      },
    },
    {
      name: 'zone update',
      metatype: UpdateZoneDto,
      payload: { name: 'Updated Zone' },
    },
  ])('$name', ({ metatype, payload }) => {
    const metadata: ArgumentMetadata = { metatype, type: 'body' };

    it('preserves valid fields through global and Zod validation', async () => {
      const globallyValidated: unknown =
        (await new CustomValidationPipe().transform(
          payload,
          metadata,
        )) as unknown;
      const validated: unknown = new ZodValidationPipe().transform(
        globallyValidated,
        metadata,
      ) as unknown;

      expect(validated).toEqual(payload);
    });

    it('rejects unknown fields at the global validation pipe', async () => {
      await expect(
        new CustomValidationPipe().transform(
          { ...payload, unexpected: true },
          metadata,
        ),
      ).rejects.toBeInstanceOf(HttpException);
    });
  });

  it('includes sector descriptions in sanitized responses', () => {
    const createdDate = new Date('2026-09-27T00:00:00.000Z');
    const sector = Object.assign(new Sector(), {
      id: 1,
      name: 'Agriculture',
      description: 'A sector description',
      created_date: createdDate,
    });

    expect(SectorSanitized.from(sector)).toEqual({
      id: 1,
      name: 'Agriculture',
      description: 'A sector description',
      created_date: createdDate,
    });
  });
});
