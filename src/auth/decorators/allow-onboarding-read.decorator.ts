import { SetMetadata } from '@nestjs/common';

export const ALLOW_ONBOARDING_READ_KEY = 'allowOnboardingRead';
export const AllowOnboardingRead = () =>
  SetMetadata(ALLOW_ONBOARDING_READ_KEY, true);
