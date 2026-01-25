import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { PrismaHealthIndicator } from './prisma.health';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
  ) {}

  @Get('live')
  live() {
    return {
      ok: true,
      api: 'up',
      ts: new Date().toISOString(),
    };
  }

  @Get('ready')
  @HealthCheck()
  async ready() {
    const ts = new Date().toISOString();

    const result = await this.health.check([
      () => this.prismaIndicator.isHealthy('db'),
    ]);

    // Terminus returns a structured object. If DB is down, status won't be "ok".
    // We translate that into your response shape + 503.
    if (result.status !== 'ok') {
      throw new ServiceUnavailableException({
        ok: false,
        api: 'up',
        db: 'down',
        ts,
      });
    }

    return {
      ok: true,
      api: 'up',
      db: 'up',
      ts,
    };
  }

  @Get()
  async healthRoot() {
    // keep it simple: same as ready
    return this.ready();
  }
}
