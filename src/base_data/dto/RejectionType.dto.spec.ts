import { ArgumentMetadata, HttpException } from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import { CustomValidationPipe } from 'src/utils/CustomValidationPipe';
import {
  CreateRejectionTypeDto,
  UpdateRejectionTypeDto,
  createRejectionTypeSchema,
} from './RejectionType.dto';

describe('Annotation/rejection reference-data validation', () => {
  describe.each([
    {
      operation: 'create',
      metatype: CreateRejectionTypeDto,
      type: 'body' as const,
    },
    {
      operation: 'update',
      metatype: UpdateRejectionTypeDto,
      type: 'body' as const,
    },
    {
      operation: 'query',
      metatype: UpdateRejectionTypeDto,
      type: 'query' as const,
    },
  ])('$operation', ({ operation, metatype, type }) => {
    const metadata: ArgumentMetadata = { metatype, type };
    const transform = async (payload: unknown) => {
      const validated: unknown = await new CustomValidationPipe().transform(
        payload,
        metadata,
      );
      return new ZodValidationPipe().transform(validated, metadata) as unknown;
    };

    it('preserves known fields through global validation then the route Zod pipe', async () => {
      const payload = {
        name: 'Quality',
        description: 'Reference data for submission review',
      };
      await expect(transform(payload)).resolves.toEqual(payload);
    });

    it('allows an omitted description', async () => {
      await expect(transform({ name: 'Quality' })).resolves.toEqual({
        name: 'Quality',
      });
    });

    it('allows an empty description', async () => {
      await expect(
        transform({ name: 'Quality', description: '' }),
      ).resolves.toEqual({ name: 'Quality', description: '' });
    });

    it.each([
      { name: '' },
      { name: ' \n\t' },
      { name: null },
      { name: 123 },
      { name: ['Quality'] },
      { name: 'Quality', description: null },
      { name: 'Quality', description: 123 },
      { name: 'Quality', unexpected: true },
      { name: 'Quality', created_by: 'client-supplied-user' },
    ])(
      'rejects invalid or unknown fields in %j at the global pipe',
      async (payload) => {
        await expect(
          new CustomValidationPipe().transform(payload, metadata),
        ).rejects.toBeInstanceOf(HttpException);
      },
    );

    it('requires name only for create', async () => {
      for (const payload of [{}, { description: 'Updated description' }]) {
        if (operation === 'create') {
          await expect(transform(payload)).rejects.toBeInstanceOf(
            HttpException,
          );
        } else {
          await expect(transform(payload)).resolves.toEqual(payload);
        }
      }
    });
  });

  it('keeps the exported create schema consistent with required nonblank names', () => {
    expect(createRejectionTypeSchema.safeParse({}).success).toBe(false);
    expect(createRejectionTypeSchema.safeParse({ name: '   ' }).success).toBe(
      false,
    );
    expect(
      createRejectionTypeSchema.safeParse({ name: 'Quality' }).success,
    ).toBe(true);
  });
});
