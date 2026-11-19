import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createTaskTypeSchema = z
  .object({
    task_type: z.enum(['audio-text', 'text-audio', 'text-text', 'image-text']),
  })
  .required();

export const updateTaskTypeSchema = createTaskTypeSchema.partial();

export class CreateTaskTypeDto extends createZodDto(createTaskTypeSchema) {}
export class UpdateTaskTypeDto extends createZodDto(updateTaskTypeSchema) {}
