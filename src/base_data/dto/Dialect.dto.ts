import { Allow } from 'class-validator';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createDialectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  language_id: z.string().uuid(),
});
export const UpdateDialectSchema = createDialectSchema.partial();

export class CreateDialectDto extends createZodDto(createDialectSchema) {
  @Allow()
  name: string;

  @Allow()
  description?: string;

  @Allow()
  language_id: string;
}

export class UpdateDialectDto extends createZodDto(UpdateDialectSchema) {
  @Allow()
  name?: string;

  @Allow()
  description?: string;

  @Allow()
  language_id?: string;
}
