import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';

import { EmailService } from './email.service';
import { EmailProcessor } from './email.processor';

@Module({
  imports: [
    ConfigModule,

    // ─── Redis connection (shared across all queues in this app) ───────────
    // Using forRootAsync so we can read the Redis URL from ConfigService.
    // When REDIS_URL is set (production), Bull uses that URI directly.
    // Otherwise, it falls back to REDIS_HOST / REDIS_PORT env vars or localhost.
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');

        if (redisUrl) {
          return { url: redisUrl };
        }

        return {
          redis: {
            host: configService.get<string>('REDIS_HOST') || 'localhost',
            port: configService.get<number>('REDIS_PORT') || 6379,
          },
        };
      },
    }),

    // ─── Register the 'email' queue ────────────────────────────────────────
    BullModule.registerQueue({ name: 'email' }),
  ],
  providers: [EmailService, EmailProcessor],
  exports: [EmailService],
})
export class EmailModule {}
