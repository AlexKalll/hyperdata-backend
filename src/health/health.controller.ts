import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckService,
  HealthCheck,
  TypeOrmHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private readonly disk: DiskHealthIndicator,
    private db: TypeOrmHealthIndicator,
    // private readonly memory: MemoryHealthIndicator
  ) {}

  @Get('/')
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () =>
        this.disk.checkStorage('storage', { path: '/', thresholdPercent: 0.5 }),
      //   () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
      //   () => this.memory.checkRSS('memory_rss', 150 * 1024 * 1024),
    ]);
  }
}
