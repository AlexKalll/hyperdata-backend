import {
  checkIfMicroTasIskRejectedAndTotalAttempts,
  getMicroTaskStatus,
} from './MicroTask.util';
import { DataSetStatus } from './constants/DataSetStatus.constant';

describe('microtask retry state', () => {
  const rejectedMicroTask = (attempts: number) => ({
    dataSets: Array.from({ length: attempts }, () => ({
      status: DataSetStatus.REJECTED,
    })),
  });

  it('allows the configured retry after the initial rejected attempt', () => {
    expect(getMicroTaskStatus(rejectedMicroTask(1) as any, 1).canRetry).toBe(
      true,
    );
    expect(
      checkIfMicroTasIskRejectedAndTotalAttempts(rejectedMicroTask(1) as any, 1)
        .canRetry,
    ).toBe(true);
  });

  it('stops retries after the configured retry is used', () => {
    expect(getMicroTaskStatus(rejectedMicroTask(2) as any, 1).canRetry).toBe(
      false,
    );
    expect(
      checkIfMicroTasIskRejectedAndTotalAttempts(rejectedMicroTask(2) as any, 1)
        .canRetry,
    ).toBe(false);
  });
});
