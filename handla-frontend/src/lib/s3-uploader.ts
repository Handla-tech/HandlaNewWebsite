import axios from 'axios';
import { chatApi } from './api';
import type {
  PresignedUrlRequest,
  PresignedUrlResult,
  UploadProgress,
  UploadResult,
} from '@/types';

// ─── Max file size: 5 MB (must match backend PresignedUrlDto) ─────────────────
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

// ─── Allowed MIME types ───────────────────────────────────────────────────────
export const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'application/zip',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a consistent S3 key for a chat file upload.
 * Format: `chat/{conversationId}/{timestamp}-{sanitizedFilename}`
 */
export function buildChatFileKey(
  conversationId: string,
  file: File,
): string {
  const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `chat/${conversationId}/${Date.now()}-${sanitized}`;
}

/**
 * Validate a file before requesting a presigned URL.
 * Throws an error with a user-readable message on failure.
 */
export function validateFile(file: File): void {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MB.`);
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`File type "${file.type}" is not allowed.`);
  }
}

// ─── Core upload function ─────────────────────────────────────────────────────

export interface UploadOptions {
  conversationId: string;
  file: File;
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
}

/**
 * Full upload pipeline:
 *  1. Validate file locally
 *  2. Request a presigned PUT URL from the backend
 *  3. PUT the file directly to S3 (with progress reporting)
 *  4. Return the permanent file URL
 */
export async function uploadChatFile(options: UploadOptions): Promise<UploadResult> {
  const { conversationId, file, onProgress, signal } = options;

  // 1 — local validation (fast fail)
  validateFile(file);

  // 2 — get presigned URL from backend
  const requestPayload: PresignedUrlRequest = {
    fileName: file.name,
    contentType: file.type,
    fileSize: file.size,
  };

  const presignedResponse = await chatApi.getPresignedUrl(requestPayload);
  const presigned: PresignedUrlResult = presignedResponse.data?.data ?? presignedResponse.data;

  // 3 — PUT directly to S3 (no auth headers — signed URL handles auth)
  await axios.put(presigned.url, file, {
    headers: {
      'Content-Type': file.type,
    },
    signal,
    onUploadProgress: (event) => {
      if (onProgress && event.total) {
        onProgress({
          loaded: event.loaded,
          total: event.total,
          percentage: Math.round((event.loaded / event.total) * 100),
        });
      }
    },
  });

  // 4 — return the permanent URL
  return {
    fileUrl: presigned.fileUrl,
    key: presigned.key,
    contentType: file.type,
    size: file.size,
  };
}

// ─── Convenience wrapper with error normalisation ─────────────────────────────

export async function safeUploadChatFile(
  options: UploadOptions,
): Promise<{ result: UploadResult | null; error: string | null }> {
  try {
    const result = await uploadChatFile(options);
    return { result, error: null };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : 'Upload failed. Please try again.';
    return { result: null, error: message };
  }
}

// ─── File type helpers ────────────────────────────────────────────────────────

export function isImageType(contentType: string): boolean {
  return contentType.startsWith('image/');
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getFileIcon(contentType: string): string {
  if (contentType.startsWith('image/'))       return '🖼️';
  if (contentType === 'application/pdf')       return '📄';
  if (contentType.includes('word'))            return '📝';
  if (contentType.includes('excel') || contentType.includes('spreadsheet')) return '📊';
  if (contentType.startsWith('text/'))         return '📃';
  if (contentType.includes('zip'))             return '🗜️';
  return '📎';
}
