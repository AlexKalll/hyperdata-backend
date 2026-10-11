import { Allow } from 'class-validator';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createZoneSchema = z.object({
  name: z.string().min(1),
  region_id: z.string().uuid(),
});
export const updateZoneSchema = z.object({
  name: z.string().min(4).optional(),
  region_id: z.string().optional(),
});
export class CreateZoneDto extends createZodDto(createZoneSchema) {
  @Allow()
  name: string;

  @Allow()
  region_id: string;
}

export class UpdateZoneDto extends createZodDto(updateZoneSchema) {
  @Allow()
  name?: string;

  @Allow()
  region_id?: string;
}
