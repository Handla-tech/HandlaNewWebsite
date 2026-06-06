import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, QueryFailedError, Repository } from 'typeorm';

import { User } from '../auth/entities/user.entity';
import { UserRole } from '../../common/enums';
import { UpdateProfileDto } from './dto/update-profile.dto';

/**
 * Sanitised profile shape returned to the client — never includes the
 * password hash even though the column is `@Exclude`d on the entity. We
 * also re-shape the timestamps to ISO strings for stable JSON.
 */
export interface ProfileResponse {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl: string | null;
  bio: string | null;
  phoneNumber: string | null;
  jobTitle: string | null;
  company: string | null;
  location: string | null;
  isArchived: boolean;
  archivedAt: string | null;
  isDisabled: boolean;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class ProfilesService {
  private readonly logger = new Logger(ProfilesService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  // ─── Read ───────────────────────────────────────────────────────────────────

  /** Get the profile of the authenticated user. */
  async getMe(userId: string): Promise<ProfileResponse> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.toResponse(user);
  }

  /**
   * Get any user's profile by id.
   *
   * Authorisation policy (enforced in the controller):
   *   • ADMIN          — can read any profile
   *   • non-ADMIN user — can read only their own profile
   *
   * The service itself does NOT perform the role check — it just fetches.
   * Keeping the check in the controller lets us reuse this method from
   * places where the rule differs (e.g. an internal "show me the author
   * of this contract" lookup that bypasses the per-call rule).
   */
  async findById(id: string): Promise<ProfileResponse> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return this.toResponse(user);
  }

  // ─── Update ─────────────────────────────────────────────────────────────────

  /**
   * Update a user's profile. The controller decides who is allowed to call
   * this for which target — see policy comment on findById().
   *
   * Side-effects:
   *   • If `email` is changed we check uniqueness across the users table
   *     before saving so the friendly 409 message wins over the DB error.
   */
  async update(targetUserId: string, dto: UpdateProfileDto): Promise<ProfileResponse> {
    const user = await this.userRepo.findOne({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException('User not found');

    // Defensive email uniqueness check — pre-empts the database UNIQUE
    // constraint so callers get a 409 (instead of a 500 wrapping ER_DUP_ENTRY)
    if (dto.email !== undefined && dto.email !== user.email) {
      const duplicate = await this.userRepo.findOne({
        where: { email: dto.email, id: Not(targetUserId) },
      });
      if (duplicate) {
        throw new ConflictException('Email already in use by another account');
      }
    }

    // Apply only fields that were actually provided (undefined means "leave alone";
    // null / empty string means "clear this field").
    if (dto.name        !== undefined) user.name        = dto.name;
    if (dto.email       !== undefined) user.email       = dto.email;
    if (dto.avatarUrl   !== undefined) user.avatarUrl   = dto.avatarUrl;
    if (dto.bio         !== undefined) user.bio         = dto.bio;
    if (dto.phoneNumber !== undefined) user.phoneNumber = dto.phoneNumber;
    if (dto.jobTitle    !== undefined) user.jobTitle    = dto.jobTitle;
    if (dto.company     !== undefined) user.company     = dto.company;
    if (dto.location    !== undefined) user.location    = dto.location;

    try {
      const saved = await this.userRepo.save(user);
      return this.toResponse(saved);
    } catch (err) {
      // Belt-and-braces: if a concurrent request just inserted a row with the
      // same email, the upstream uniqueness check might have missed it. Translate
      // the raw DB error into a friendly 409.
      if (err instanceof QueryFailedError) {
        const inner = (err as any).driverError ?? err;
        if (inner?.code === 'ER_DUP_ENTRY' || inner?.errno === 1062) {
          throw new ConflictException('Email already in use by another account');
        }
      }
      throw err;
    }
  }

  // ─── Avatar helpers ─────────────────────────────────────────────────────────

  /**
   * Persist the new avatar URL after the client has finished uploading the
   * image to S3 via a presigned URL. Kept as a thin helper so the controller
   * stays readable and so unit tests don't have to construct a full DTO.
   */
  async setAvatarUrl(targetUserId: string, avatarUrl: string | null): Promise<ProfileResponse> {
    const user = await this.userRepo.findOne({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException('User not found');
    user.avatarUrl = avatarUrl;
    const saved = await this.userRepo.save(user);
    return this.toResponse(saved);
  }

  // ─── Authorisation helper ──────────────────────────────────────────────────

  /**
   * Throws ForbiddenException unless either:
   *   • the requester IS the target user, or
   *   • the requester is an ADMIN.
   *
   * Exposed so the controller can do the check in one line and so tests can
   * verify policy directly without hitting the DB.
   */
  assertSelfOrAdmin(requester: User, targetUserId: string): void {
    if (requester.id === targetUserId) return;
    if (requester.role === UserRole.ADMIN) return;
    throw new ForbiddenException('You can only access your own profile');
  }

  // ─── Mapping ───────────────────────────────────────────────────────────────

  toResponse(user: User): ProfileResponse {
    return {
      id:          user.id,
      email:       user.email,
      name:        user.name,
      role:        user.role,
      avatarUrl:   user.avatarUrl ?? null,
      bio:         user.bio ?? null,
      phoneNumber: user.phoneNumber ?? null,
      jobTitle:    user.jobTitle ?? null,
      company:     user.company ?? null,
      location:    user.location ?? null,
      isArchived:  user.isArchived,
      archivedAt:  user.archivedAt ? user.archivedAt.toISOString() : null,
      isDisabled:  user.isDisabled,
      createdAt:   user.createdAt instanceof Date ? user.createdAt.toISOString() : (user.createdAt as any),
      updatedAt:   user.updatedAt instanceof Date ? user.updatedAt.toISOString() : (user.updatedAt as any),
    };
  }
}
