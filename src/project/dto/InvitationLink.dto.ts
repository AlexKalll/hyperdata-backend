import { Allow, IsString, MinLength } from 'class-validator';
import { OmitType } from '@nestjs/swagger';
import { CreateUserDto } from 'src/auth/dto/User.dto';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createInvitationLinkSchema = z.object({
  expiry_date: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid date format',
    })
    .transform((val) => new Date(val)),
  role: z.enum(['Contributor', 'Facilitator', 'Reviewer']).optional(),
  organization_id: z.string().uuid().optional(),
  max_invitations: z.number().int().positive().optional(),
});

export const updateInvitationLinkSchema = createInvitationLinkSchema.partial();
// Invitees choose their own password; the invitation, not the submitted body,
// determines the role. Reuse the globally validated profile field contract.
export class AcceptInvitationDto extends OmitType(CreateUserDto, [
  'role_id',
] as const) {
  @IsString()
  @MinLength(8)
  password: string;
}
export class createInvitationLinkDto extends createZodDto(
  createInvitationLinkSchema,
) {
  // The global class-validator whitelist runs before the route's Zod pipe.
  @Allow()
  expiry_date: Date;

  @Allow()
  role?: 'Contributor' | 'Facilitator' | 'Reviewer';

  @Allow()
  organization_id?: string;

  @Allow()
  max_invitations?: number;
}
export class updateInvitationLinkDto extends createZodDto(
  updateInvitationLinkSchema,
) {}
