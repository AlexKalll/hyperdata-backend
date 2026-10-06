import { ValidationPipe, ValidationError } from '@nestjs/common';
import { HttpException } from '@nestjs/common';

export class CustomValidationPipe extends ValidationPipe {
  constructor() {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors: ValidationError[]) => {
        // Extract all error messages and join them into a single string
        const messages = errors
          .map((error) => Object.values(error.constraints || {}).join(', '))
          .filter((message) => message)
          .join('; ');

        return new HttpException(
          {
            message: messages || 'Validation failed',
            error: 'Bad Request',
            statusCode: 400,
          },
          400,
        );
      },
    });
  }
}
