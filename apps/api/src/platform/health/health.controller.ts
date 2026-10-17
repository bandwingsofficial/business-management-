import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { ApplicationError } from '@/common/errors/application-error';
import { Public } from '@/platform/http/auth.guard';

import { ReadinessService } from './readiness';

export interface HealthStatus {
  readonly status: 'ok';
}

@ApiTags('health')
@Controller({ version: '1' })
export class HealthController {
  public constructor(@Inject(ReadinessService) private readonly readiness: ReadinessService) {}

  @Get('health')
  @Public()
  @ApiOkResponse({ description: 'The process is alive. Infrastructure is not contacted.' })
  public getHealth(): HealthStatus {
    return { status: 'ok' };
  }

  @Get('ready')
  @Public()
  @ApiOkResponse({
    description: 'The process can serve traffic, or a configured dependency is down.',
  })
  public async getReady(): Promise<{ status: 'ready'; checks: Readonly<Record<string, string>> }> {
    const report = await this.readiness.check(1000);
    if (report.status === 'not_ready') {
      throw new ApplicationError(
        'NOT_READY',
        'The service is not ready.',
        undefined,
        503,
        Object.entries(report.checks).map(([path, message]) => ({ path, message })),
      );
    }
    return { status: 'ready', checks: report.checks };
  }
}
