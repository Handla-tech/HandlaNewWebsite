/**
 * Avatar upload pipeline.
 *
 * Steps:
 *   1. Validate the file locally (size + MIME) — fast fail.
 *   2. POST /profiles/me/avatar-upload via multipart/form-data.
 *
 * Returns the updated User profile so the caller can update its store / UI
 * without an extra GET round-trip.
 */
import { profilesApi } from './api';
import type { User } from '@/types';

// ─── Constraints (UX only; backend independently validates size & magic bytes) ─

/** Max avatar size — 5 MB. Backend has its own check too. */
export const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

/** Allowed MIME types for client-side feedback. */
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

  // 2 — Upload directly to backend
  const formData = new FormData();
  formData.append('file', file);

  const response = await profilesApi.uploadAvatar(formData, {
    signal,
    onUploadProgress: (event) => {
      if (onProgress && event.total) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    },
  });

  const profile: User = response.data?.data?.profile ?? response.data?.profile ?? response.data;

  return { avatarUrl: profile.avatarUrl!, profile };
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
