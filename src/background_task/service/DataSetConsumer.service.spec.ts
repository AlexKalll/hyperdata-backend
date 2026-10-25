import { MicroTask } from 'src/data_set/entities/MicroTask.entity';
import { DataSet } from 'src/data_set/entities/DataSet.entity';
import { DataSetStatus } from 'src/utils/constants/DataSetStatus.constant';
import { hasPassedAllContributorTests } from './DataSetConsumer.service';

const attempt = (contributor_id: string, status: string) =>
  ({ contributor_id, status }) as DataSet;

const testMicroTask = (id: string, dataSets: DataSet[]) =>
  ({ id, dataSets }) as MicroTask;

describe('hasPassedAllContributorTests', () => {
  it('does not pass an empty exam', () => {
    expect(hasPassedAllContributorTests([], 'contributor-1')).toBe(false);
  });

  it('requires a contributor submission for every test microtask', () => {
    expect(
      hasPassedAllContributorTests(
        [
          testMicroTask('test-1', [
            attempt('contributor-1', DataSetStatus.APPROVED),
          ]),
          testMicroTask('test-2', []),
        ],
        'contributor-1',
      ),
    ).toBe(false);
  });

  it.each([DataSetStatus.PENDING, DataSetStatus.REJECTED])(
    'does not pass while any test microtask is %s',
    (status) => {
      expect(
        hasPassedAllContributorTests(
          [
            testMicroTask('test-1', [
              attempt('contributor-1', DataSetStatus.APPROVED),
            ]),
            testMicroTask('test-2', [attempt('contributor-1', status)]),
          ],
          'contributor-1',
        ),
      ).toBe(false);
    },
  );

  it('requires approval by this contributor for every test microtask', () => {
    expect(
      hasPassedAllContributorTests(
        [
          testMicroTask('test-1', [
            attempt('contributor-1', DataSetStatus.APPROVED),
          ]),
          testMicroTask('test-2', [
            attempt('contributor-2', DataSetStatus.APPROVED),
          ]),
        ],
        'contributor-1',
      ),
    ).toBe(false);
  });

  it('passes after every test microtask is approved for the contributor', () => {
    expect(
      hasPassedAllContributorTests(
        [
          testMicroTask('test-1', [
            attempt('contributor-1', DataSetStatus.APPROVED),
          ]),
          testMicroTask('test-2', [
            attempt('contributor-1', DataSetStatus.APPROVED),
            attempt('contributor-2', DataSetStatus.PENDING),
          ]),
        ],
        'contributor-1',
      ),
    ).toBe(true);
  });
});
