/**
 * Website image upload pipeline (ERP admin → S3).
 *
 * Used by the "Website Projects" and "Website Products" admin editors to upload
 * a cover image directly to S3 and get back a permanent, publicly-readable URL
 * that is stored on the record's `imageUrl`.
 *
 * Steps:
 *   1. Validate the file locally (size + MIME) — fast fail.
 *   2. POST /website/projects/image-upload → presigned S3 PUT URL (ADMIN only).
 *   3. PUT the file directly to S3 with `x-amz-acl: public-read` so the object
 *      is world-readable and the public marketing site can render it in an
 *      <img> without a signed URL.
 *   4. Return the permanent public fileUrl.
 */
import axios from 'axios';
import { websiteProjectApi } from './api';
import type { PresignedUrlResult } from '@/types';

// ─── Constraints (must match backend WebsiteImageUploadDto) ───────────────────

/** Max website image size — 5 MB. */
export const MAX_WEBSITE_IMAGE_SIZE = 5 * 1024 * 1024;

/** Allowed MIME types — must match the regex in WebsiteImageUploadDto (no SVG). */
export const ALLOWED_WEBSITE_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

// ─── Local validation ─────────────────────────────────────────────────────────

export function validateWebsiteImage(file: File): void {
  if (file.size > MAX_WEBSITE_IMAGE_SIZE) {
    throw new Error(
      `Image too large. Maximum size is ${MAX_WEBSITE_IMAGE_SIZE / 1024 / 1024} MB.`,
    );
  }
  if (!ALLOWED_WEBSITE_IMAGE_TYPES.includes(file.type)) {
    throw new Error('Unsupported image type. Please use JPEG, PNG, WEBP or GIF.');
  }
}

// ─── Main upload pipeline ─────────────────────────────────────────────────────

export interface WebsiteImageUploadOptions {
  file: File;
  onProgress?: (percentage: number) => void;
  signal?: AbortSignal;
}

/**
 * Upload a website image to S3 and return its permanent public URL.
 * Does NOT persist anything on the record — the caller writes the returned URL
 * into the form's `imageUrl` field and saves the record separately.
 */
export async function uploadWebsiteImage(
  options: WebsiteImageUploadOptions,
): Promise<string> {
  const { file, onProgress, signal } = options;

  // 1 — Local validation
  validateWebsiteImage(file);

  // 2 — Request presigned URL
  const presignedRes = await websiteProjectApi.getImageUploadUrl({
    fileName: file.name,
    contentType: file.type,
  });
  const presigned: PresignedUrlResult =
    presignedRes.data?.data ?? presignedRes.data;

  // 3 — PUT directly to S3. The ACL header MUST match the presigned command's
  //     ACL ('public-read') or S3 rejects the PUT with SignatureDoesNotMatch.
  await axios.put(presigned.url, file, {
    headers: {
      'Content-Type': file.type,
      'x-amz-acl': 'public-read',
    },
    signal,
    onUploadProgress: (event) => {
      if (onProgress && event.total) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    },
  });

  // 4 — Return permanent public URL
  return presigned.fileUrl;
}

/** Catch-and-return convenience wrapper for UI components. */
export async function safeUploadWebsiteImage(
  options: WebsiteImageUploadOptions,
): Promise<{ url: string | null; error: string | null }> {
  try {
    const url = await uploadWebsiteImage(options);
    return { url, error: null };
  } catch (err: unknown) {
    const message =
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
      (err instanceof Error ? err.message : 'Image upload failed. Please try again.');
    return { url: null, error: typeof message === 'string' ? message : 'Image upload failed.' };
  }
}
