import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { AnalyticsEventType } from '../../../common/enums';

/**
 * ANL-1 — AnalyticsEvent
 *
 * A single self-hosted, GA-style hit. Written by the public collect endpoint
 * that the tracking script (`public/analytics.js`) beacons to. No PII is
 * required: the visitor is a rotating anonymous hash; IPs are only used to
 * derive coarse country (and are not stored raw here).
 *
 * `site` lets one backend serve multiple tracked properties.
 * `eventName` is meaningful only for type=EVENT (e.g. "signup", "cta_click").
 * `meta` carries arbitrary custom props from the script.
 */
@Entity('analytics_events')
@Index('idx_analytics_site_time', ['site', 'createdAt'])
@Index('idx_analytics_type_time', ['type', 'createdAt'])
export class AnalyticsEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, default: 'default' })
  @Index('idx_analytics_site')
  site: string;

  @Column({ type: 'enum', enum: AnalyticsEventType, default: AnalyticsEventType.PAGEVIEW })
  type: AnalyticsEventType;

  /** Custom event name (null for pageviews). */
  @Column({ name: 'event_name', type: 'varchar', length: 120, nullable: true })
  eventName: string | null;

  // ─── Page context ────────────────────────────────────────────────────────
  @Column({ type: 'varchar', length: 1024, nullable: true })
  url: string | null;

  /** Normalized path (query/hash stripped) for top-pages grouping. */
  @Column({ type: 'varchar', length: 512, nullable: true })
  @Index('idx_analytics_path')
  path: string | null;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  referrer: string | null;

  /** Parsed referrer host, e.g. "google.com" or "direct". */
  @Column({ name: 'referrer_host', type: 'varchar', length: 255, nullable: true })
  referrerHost: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title: string | null;

  // ─── Visitor / session (anonymous, rotating hashes) ─────────────────────────
  @Column({ name: 'visitor_id', type: 'varchar', length: 64, nullable: true })
  @Index('idx_analytics_visitor')
  visitorId: string | null;

  @Column({ name: 'session_id', type: 'varchar', length: 64, nullable: true })
  sessionId: string | null;

  // ─── Device / environment ────────────────────────────────────────────────
  @Column({ name: 'device_type', type: 'varchar', length: 20, nullable: true })
  deviceType: string | null; // desktop | mobile | tablet

  @Column({ type: 'varchar', length: 60, nullable: true })
  browser: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  os: string | null;

  @Column({ type: 'varchar', length: 2, nullable: true })
  country: string | null; // ISO-3166 alpha-2 (best-effort)

  @Column({ type: 'varchar', length: 10, nullable: true })
  language: string | null;

  /** UTM + arbitrary custom props. */
  @Column({ type: 'json', nullable: true })
  meta: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at' })
  @Index('idx_analytics_created_at')
  createdAt: Date;
}
