import { Allow } from 'class-validator';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createLanguageSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
});
export const updateLanguageSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().optional(),
});
export class CreateLanguageDto extends createZodDto(createLanguageSchema) {
  @Allow()
  name: string;

  @Allow()
  code?: string;
}

export class UpdateLanguageDto extends createZodDto(updateLanguageSchema) {
  @Allow()
  name?: string;

  @Allow()
  code?: string;
}
