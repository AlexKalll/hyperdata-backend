import { Allow } from 'class-validator';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createSectorSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});
export const updateSectorSchema = createSectorSchema.partial();

export class CreateSectorDto extends createZodDto(createSectorSchema) {
  @Allow()
  name: string;

  @Allow()
  description?: string;
}

export class UpdateSectorDto extends createZodDto(updateSectorSchema) {
  @Allow()
  name?: string;

  @Allow()
  description?: string;
}
