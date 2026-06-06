/**
 * Avatar upload pipeline.
 *
 * Steps:
 *   1. Validate the file locally (size + MIME) — fast fail.
 *   2. POST /profiles/me/avatar-upload  → presigned S3 PUT URL.
 *   3. PUT the file directly to S3 (no auth headers — signed URL handles it).
 *   4. PATCH /profiles/me with { avatarUrl } to persist the new URL.
 *
 * Returns the updated User profile so the caller can update its store / UI
 * without an extra GET round-trip.
 */
import axios from 'axios';
import { profilesApi } from './api';
import type { PresignedUrlResult, User } from '@/types';

// ─── Constraints (must match backend AvatarUploadDto) ─────────────────────────

/** Max avatar size — 5 MB. Backend has its own check too. */
export const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

/** Allowed MIME types — must match the regex in AvatarUploadDto. */
export const ALLOWED_AVATAR_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

// ─── Local validation ─────────────────────────────────────────────────────────

export function validateAvatar(file: File): void {
  if (file.size > MAX_AVATAR_SIZE) {
    throw new Error(
      `Image too large. Maximum size is ${MAX_AVATAR_SIZE / 1024 / 1024} MB.`,
    );
  }
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
    throw new Error(
      'Unsupported image type. Please use JPEG, PNG, WEBP or GIF.',
    );
  }
}

// ─── Main upload pipeline ─────────────────────────────────────────────────────

export interface AvatarUploadOptions {
  file: File;
  onProgress?: (percentage: number) => void;
  signal?: AbortSignal;
}

export interface AvatarUploadResult {
  /** Final public S3 URL of the new avatar (already persisted on the user). */
  avatarUrl: string;
  /** The updated profile returned by PATCH /profiles/me. */
  profile: User;
}

/**
 * Upload a new avatar and persist it on the current user's profile.
 *
 * NOTE: We intentionally do NOT swallow errors here — the caller (UI) decides
 * how to display them. Use `safeUploadAvatar` for the catch-and-return variant.
 */
export async function uploadAvatar(
  options: AvatarUploadOptions,
): Promise<AvatarUploadResult> {
  const { file, onProgress, signal } = options;

  // 1 — Local validation
  validateAvatar(file);

  // 2 — Request presigned URL
  const presignedRes = await profilesApi.getAvatarUploadUrl({
    fileName: file.name,
    contentType: file.type,
  });
  const presigned: PresignedUrlResult =
    presignedRes.data?.data ?? presignedRes.data;

  // 3 — PUT directly to S3
  await axios.put(presigned.url, file, {
    headers: { 'Content-Type': file.type },
    signal,
    onUploadProgress: (event) => {
      if (onProgress && event.total) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    },
  });

  // 4 — Persist on the user
  const patchRes = await profilesApi.updateMe({ avatarUrl: presigned.fileUrl });
  const profile: User = patchRes.data?.data?.profile ?? patchRes.data?.profile ?? patchRes.data;

  return { avatarUrl: presigned.fileUrl, profile };
}

/** Catch-and-return convenience wrapper for UI components. */
export async function safeUploadAvatar(
  options: AvatarUploadOptions,
): Promise<{ result: AvatarUploadResult | null; error: string | null }> {
  try {
    const result = await uploadAvatar(options);
    return { result, error: null };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Avatar upload failed. Please try again.';
    return { result: null, error: message };
  }
}
