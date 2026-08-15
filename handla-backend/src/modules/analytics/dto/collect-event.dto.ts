import {
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
  Length,
  MaxLength,
} from 'class-validator';
import { AnalyticsEventType } from '../../../common/enums';

/**
 * ANL-1 — payload beaconed by the tracking script to POST /api/analytics/collect.
 *
 * All fields are optional/loose because they come from arbitrary browsers. The
 * server derives path/referrerHost/device/country and assigns the visitor +
 * session, so callers cannot spoof those. Kept whitelisted (global pipe has
 * forbidNonWhitelisted=true).
 */
export class CollectEventDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  site?: string;

  @IsOptional()
  @IsEnum(AnalyticsEventType)
  type?: AnalyticsEventType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  eventName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  referrer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  /** Screen width in px — used to classify device when UA is ambiguous. */
  @IsOptional()
  screenWidth?: number;

  /**
   * Client-generated visitor id sent by the tracking script (analytics.js sets
   * `payload.vid`). The server derives its own visitor hash and ignores this
   * value, but it MUST be whitelisted here — the global ValidationPipe runs with
   * forbidNonWhitelisted=true, so an unknown property would 400 the beacon.
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  vid?: string;

  @IsOptional()
  @IsObject()
  meta?: Record<string, any>;
}
