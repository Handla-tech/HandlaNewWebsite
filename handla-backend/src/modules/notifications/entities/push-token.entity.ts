import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

/**
 * A device push token registered by a mobile client (Expo push token).
 *
 * One user can have many devices; a given token string is globally unique
 * (Expo issues one per install) so we can upsert on it and re-assign a device
 * to whichever user last signed in on it.
 */
@Index('idx_push_token_user', ['userId'])
@Unique('uq_push_token_token', ['token'])
@Entity('push_tokens')
export class PushToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId: string;

  /** Expo push token, e.g. "ExponentPushToken[xxxxxxxx]". */
  @Column({ type: 'varchar', length: 255 })
  token: string;

  /** 'ios' | 'android' | 'web' — informational, for targeting/debugging. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  platform: string | null;

  /** Human-readable device label (e.g. "iPhone 15"), optional. */
  @Column({ name: 'device_name', type: 'varchar', length: 120, nullable: true })
  deviceName: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
