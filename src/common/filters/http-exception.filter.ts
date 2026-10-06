// src/common/filters/http-exception.filter.ts

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()['message'] || exception.message
        : 'Internal server error';

    //  transforming zod errors
    if (message instanceof Array) {
      response.status(status).json({
        message: 'Validation failed',
        code: status,
        data: null,
        errors: message,
        path: request.url,
        timestamp: new Date().toISOString(),
      });
      return;
    }
    response.status(status).json({
      message,
      code: status,
      data: null,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
