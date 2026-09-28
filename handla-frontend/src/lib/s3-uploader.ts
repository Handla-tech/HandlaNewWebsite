import api from './api';
import type {
  UploadProgress,
  UploadResult,
} from '@/types';

// ─── Max file size: 5 MB (must match backend chat upload limit) ─────────────────
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

// ─── Allowed MIME types ───────────────────────────────────────────────────────
export const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Validate a file before uploading it.
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
 *  2. Upload multipart form data through the authenticated backend
 *  3. Return server-validated file metadata
 */
export async function uploadChatFile(options: UploadOptions): Promise<UploadResult> {
  const { file, onProgress, signal } = options;

  // 1 - local validation (fast fail)
  validateFile(file);

  // 2 - send multipart form data to the authenticated backend
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/chat/upload', formData, {
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

  const result = response.data?.data ?? response.data;

  // 3 - return server-validated metadata
  return {
    fileUrl: result.fileUrl,
    key: result.key,
    contentType: result.contentType,
    size: result.size,
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
