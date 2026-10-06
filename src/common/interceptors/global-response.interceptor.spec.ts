import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of, lastValueFrom } from 'rxjs';
import { GlobalResponseInterceptor } from './global-response.interceptor';

describe('GlobalResponseInterceptor', () => {
  const interceptor = new GlobalResponseInterceptor();

  function createContext(statusCode = 201): ExecutionContext {
    return {
      switchToHttp: () => ({
        getResponse: () => ({ statusCode }),
      }),
    } as ExecutionContext;
  }

  function createHandler(data: unknown): CallHandler {
    return {
      handle: () => of(data),
    };
  }

  it('should wrap plain response data in the global response format', async () => {
    const result = await lastValueFrom(
      interceptor.intercept(createContext(202), createHandler({ ok: true })),
    );

    expect(result).toEqual({
      message: 'Success',
      code: 202,
      data: { ok: true },
    });
  });

  it('should preserve already formatted responses', async () => {
    const formattedResponse = {
      message: 'Created',
      code: 201,
      data: { id: '1' },
    };

    const result = await lastValueFrom(
      interceptor.intercept(createContext(), createHandler(formattedResponse)),
    );

    expect(result).toBe(formattedResponse);
  });
});
