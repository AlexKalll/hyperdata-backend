jest.mock('src/config/minio.config', () => ({
  multerAudioS3Storage: {},
  multerCSVS3Storage: {},
  multerImageS3Storage: {},
}));

import { DataSource } from 'typeorm';
import { DataSetController } from './DataSet.controller';
import { DataSetSanitize } from '../sanitize';

describe('DataSetController', () => {
  let controller: DataSetController;
  let dataSetService: Record<string, jest.Mock>;

  beforeEach(() => {
    dataSetService = {
      findPaginate: jest.fn(),
      findAll: jest.fn(),
      contributorSubmission: jest.fn(),
      findReviewerDataSets: jest.fn(),
    };

    controller = new DataSetController(
      dataSetService as any,
      {} as DataSource,
      {} as any,
      {} as any,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should strip pagination fields and forward dataset filters', async () => {
    const sanitizeSpy = jest
      .spyOn(DataSetSanitize, 'from')
      .mockImplementation((item: any) => ({ id: item.id }) as any);
    dataSetService.findPaginate.mockResolvedValue({
      result: [{ id: 'ds-1' }],
      total: 1,
      page: 2,
      limit: 5,
      totalPages: 1,
    });
    const query: any = {
      page: 2,
      limit: 5,
      contributor_id: 'user-1',
      status: undefined,
    };

    const result = await controller.findPaginate(query, {
      user: { id: 'admin-1' },
    } as any);

    expect(dataSetService.findPaginate).toHaveBeenCalledWith(
      { where: { contributor_id: 'user-1' } },
      { page: 2, limit: 5 },
    );
    expect(sanitizeSpy).toHaveBeenCalledWith({ id: 'ds-1' });
    expect(result.result).toEqual([{ id: 'ds-1' }]);
  });

  it('should sanitize all datasets for the all endpoint', async () => {
    const sanitizeSpy = jest
      .spyOn(DataSetSanitize, 'from')
      .mockImplementation((item: any) => ({ id: item.id }) as any);
    dataSetService.findAll.mockResolvedValue([{ id: 'ds-1' }, { id: 'ds-2' }]);

    await expect(controller.findAll({} as any)).resolves.toEqual([
      { id: 'ds-1' },
      { id: 'ds-2' },
    ]);
    expect(dataSetService.findAll).toHaveBeenCalledWith({});
    expect(sanitizeSpy).toHaveBeenCalledTimes(2);
  });

  it('should scope contributor datasets to the authenticated user', async () => {
    const sanitizeSpy = jest
      .spyOn(DataSetSanitize, 'from')
      .mockImplementation((item: any) => ({ id: item.id }) as any);
    dataSetService.findPaginate.mockResolvedValue({
      result: [{ id: 'ds-1' }],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    });

    const result = await controller.contributorDataSets(
      { page: 1, limit: 10 },
      { user: { id: 'user-1' } } as any,
    );

    expect(dataSetService.findPaginate).toHaveBeenCalledWith(
      { where: { contributor_id: 'user-1' } },
      { page: 1, limit: 10 },
    );
    expect(result.result).toEqual([{ id: 'ds-1' }]);
    expect(sanitizeSpy).toHaveBeenCalledTimes(1);
  });

  it('should forward contributor submission lookups', async () => {
    dataSetService.contributorSubmission.mockResolvedValue({
      id: 'submission-1',
    });

    await expect(
      controller.contributorSubmission('mt-1', {
        user: { id: 'user-1' },
      } as any),
    ).resolves.toEqual({ id: 'submission-1' });
    expect(dataSetService.contributorSubmission).toHaveBeenCalledWith(
      'mt-1',
      'user-1',
    );
  });

  it('should forward reviewer dataset filters and sanitize the results', async () => {
    const sanitizeSpy = jest
      .spyOn(DataSetSanitize, 'from')
      .mockImplementation((item: any) => ({ id: item.id }) as any);
    dataSetService.findReviewerDataSets.mockResolvedValue({
      result: [{ id: 'ds-1' }],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    });

    const result = await controller.findReviewerDataSets(
      'task-1',
      { page: 1, limit: 10, status: 'Pending' } as any,
      { user: { id: 'reviewer-1' } } as any,
    );

    expect(dataSetService.findReviewerDataSets).toHaveBeenCalledWith(
      'reviewer-1',
      'task-1',
      { page: 1, limit: 10 },
      'Pending',
    );
    expect(result.result).toEqual([{ id: 'ds-1' }]);
    expect(sanitizeSpy).toHaveBeenCalledTimes(1);
  });
});
