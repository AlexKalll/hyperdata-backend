import { Allow } from 'class-validator';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createCountrySchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).optional(),
  continent: z.string().min(1).optional(),
});
export const updateCountrySchema = createCountrySchema.partial();

export class CreateCountryDto extends createZodDto(createCountrySchema) {
  @Allow()
  name: string;

  @Allow()
  code?: string;

  @Allow()
  continent?: string;
}

export class UpdateCountryDto extends createZodDto(updateCountrySchema) {
  @Allow()
  name?: string;

  @Allow()
  code?: string;

  @Allow()
  continent?: string;
}

export class SearchCountryDto extends UpdateCountryDto {}
