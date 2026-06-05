import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

import { Public } from '../common/guards/jwt.guard';

@ApiTags('health')
@Controller('health')
export class HealthController {
  /**
   * Liveness / readiness probe used by Docker health-checks, load balancers,
   * and uptime monitors.  Always returns 200 OK when the process is running.
   */
  @Get()
  @Public()
  @ApiOperation({ summary: 'Health check — returns 200 OK when API is running' })
  check(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
