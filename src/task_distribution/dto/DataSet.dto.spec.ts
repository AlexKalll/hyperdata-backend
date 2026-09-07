import { HttpException } from '@nestjs/common';
import { CustomValidationPipe } from 'src/utils/CustomValidationPipe';
import { AttemptsDto, CreateMultipleDataSetDto } from './DataSet.dto';

describe('CreateMultipleDataSetDto', () => {
  const attempt = {
    micro_task_id: '3a6c87c2-bb7a-4b67-9605-4f548e17e75f',
    text_data_set: 'A transcription',
  };
  const transform = (value: unknown) =>
    new CustomValidationPipe().transform(value, {
      type: 'body',
      metatype: CreateMultipleDataSetDto,
    });

  it.each([true, false])(
    'accepts nested attempts and is_test=%s',
    async (is_test) => {
      const result = await transform({ attempts: [attempt], is_test });
      expect(result).toEqual({ attempts: [attempt], is_test });
      expect(result.attempts[0]).toBeInstanceOf(AttemptsDto);
    },
  );

  it('defaults an omitted is_test to false', async () => {
    expect(await transform({ attempts: [attempt] })).toMatchObject({
      is_test: false,
    });
  });

  it.each([
    {},
    { attempts: [] },
    { attempts: null },
    { attempts: attempt },
    { attempts: [null] },
    { attempts: ['text'] },
    { attempts: [{}] },
    { attempts: [{ ...attempt, micro_task_id: '' }] },
    { attempts: [{ ...attempt, micro_task_id: 'not-a-uuid' }] },
    { attempts: [{ micro_task_id: attempt.micro_task_id }] },
    { attempts: [{ ...attempt, text_data_set: '' }] },
    { attempts: [{ ...attempt, text_data_set: ' \n\t' }] },
    { attempts: [{ ...attempt, text_data_set: 123 }] },
    { attempts: [{ ...attempt, extra: true }] },
    { attempts: [attempt], batch: 1 },
    { attempts: [attempt], is_test: 'false' },
    { attempts: [attempt], is_test: 0 },
    { attempts: [attempt], is_test: null },
  ])('rejects invalid payload %j', async (payload) => {
    await expect(transform(payload)).rejects.toBeInstanceOf(HttpException);
  });
});
