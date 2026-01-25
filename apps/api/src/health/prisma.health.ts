import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PrismaHealthIndicator {
  constructor(
    private readonly prisma: PrismaService,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(key: string) {
    const indicator = this.healthIndicatorService.check(key);

    try {
      // simplest DB roundtrip
      await this.prisma.$queryRaw`SELECT 1`;

      return indicator.up();
    } catch {
      // You can include a string or metadata here
      return indicator.down('DB query failed');
    }
  }
}
