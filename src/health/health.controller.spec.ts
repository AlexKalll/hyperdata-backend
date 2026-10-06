import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import {
  DiskHealthIndicator,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';

describe('HealthController', () => {
  let controller: HealthController;
  let health: { check: jest.Mock };
  let disk: { checkStorage: jest.Mock };
  let db: { pingCheck: jest.Mock };

  beforeEach(async () => {
    health = { check: jest.fn() };
    disk = { checkStorage: jest.fn() };
    db = { pingCheck: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: health },
        { provide: DiskHealthIndicator, useValue: disk },
        { provide: TypeOrmHealthIndicator, useValue: db },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should run the configured health checks', async () => {
    const pingDb = { database: 'ok' };
    const diskStatus = { storage: 'ok' };

    db.pingCheck.mockResolvedValue(pingDb);
    disk.checkStorage.mockResolvedValue(diskStatus);
    health.check.mockImplementation(
      async (checks: Array<() => Promise<unknown>>) => {
        const results = await Promise.all(checks.map((check) => check()));
        return { status: 'ok', results };
      },
    );

    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      results: [pingDb, diskStatus],
    });

    expect(db.pingCheck).toHaveBeenCalledWith('database');
    expect(disk.checkStorage).toHaveBeenCalledWith('storage', {
      path: '/',
      thresholdPercent: 0.5,
    });
  });
});
