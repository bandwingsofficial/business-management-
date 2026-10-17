import { Controller, Get, Headers, Inject, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

import type { ObservabilitySettings } from '@/configs/app-config';
import { Public } from '@/platform/http/auth.guard';

import { authorizeMetrics, MetricsRegistry } from './metrics';

@Controller({ version: '1' })
export class MetricsController {
  public constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(MetricsRegistry) private readonly metrics: MetricsRegistry,
  ) {}

  @Get('metrics')
  @Public()
  public scrape(
    @Headers('authorization') authorization: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): string {
    const observability = this.config.getOrThrow<ObservabilitySettings>('observability');
    authorizeMetrics(observability.metricsToken, authorization);
    response.setHeader('content-type', 'text/plain; version=0.0.4');
    return this.metrics.render();
  }
}
