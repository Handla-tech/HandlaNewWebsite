'use client';

import { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Paperclip, X, CheckCircle2, AlertCircle, Loader2,
  FileText, FileImage, FileSpreadsheet, FileArchive, File,
} from 'lucide-react';
import {
  uploadChatFile,
  validateFile,
  formatFileSize,
  isImageType,
  MAX_FILE_SIZE,
} from '@/lib/s3-uploader';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FileUploadButtonProps {
  conversationId: string;
  onFileUploaded: (fileUrl: string, fileName: string, contentType: string) => void;
  disabled?: boolean;
}

type UploadState =
  | { status: 'idle' }
  | { status: 'validating' }
  | { status: 'uploading'; progress: number; fileName: string }
  | { status: 'success'; fileName: string }
  | { status: 'error'; message: string };

// ─── File-type icon helper ─────────────────────────────────────────────────────

function FileTypeIcon({ contentType, className }: { contentType: string; className?: string }) {
  if (isImageType(contentType))                            return <FileImage    className={className} />;
  if (contentType === 'application/pdf')                   return <FileText     className={className} />;
  if (contentType.includes('word'))                        return <FileText     className={className} />;
  if (contentType.includes('excel') || contentType.includes('spreadsheet')) return <FileSpreadsheet className={className} />;
  if (contentType.includes('zip'))                         return <FileArchive  className={className} />;
  return                                                          <File         className={className} />;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FileUploadButton({
  conversationId,
  onFileUploaded,
  disabled = false,
}: FileUploadButtonProps) {
  const inputRef  = useRef<HTMLInputElement>(null);
  const abortRef  = useRef<AbortController | null>(null);
  const [state, setState] = useState<UploadState>({ status: 'idle' });
  const [preview, setPreview] = useState<{ name: string; size: number; type: string } | null>(null);

  // ── Reset back to idle ──────────────────────────────────────────────────────
  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState({ status: 'idle' });
    setPreview(null);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  // ── Handle file selection ───────────────────────────────────────────────────
  const handleChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate immediately
      setState({ status: 'validating' });
      try {
        validateFile(file);
      } catch (err) {
        setState({ status: 'error', message: (err as Error).message });
        return;
      }

      setPreview({ name: file.name, size: file.size, type: file.type });
      setState({ status: 'uploading', progress: 0, fileName: file.name });

      // Upload
      abortRef.current = new AbortController();
      try {
        const result = await uploadChatFile({
          conversationId,
          file,
          signal: abortRef.current.signal,
          onProgress: ({ percentage }) =>
            setState({ status: 'uploading', progress: percentage, fileName: file.name }),
        });

        setState({ status: 'success', fileName: file.name });
        onFileUploaded(result.fileUrl, file.name, file.type);

        // Auto-clear success badge after 2.5 s
        setTimeout(reset, 2500);
      } catch (err: unknown) {
        if ((err as Error)?.name === 'CanceledError' || (err as Error)?.name === 'AbortError') {
          reset();
          return;
        }
        setState({
          status: 'error',
          message: (err as Error)?.message ?? 'Upload failed. Please try again.',
        });
      }
    },
    [conversationId, onFileUploaded, reset],
  );

  const isUploading = state.status === 'uploading' || state.status === 'validating';

  return (
    <div className="relative flex-shrink-0">
      {/* ── Hidden native file input ──────────────────────────────────── */}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={[
          'image/*',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/plain',
          'text/csv',
          'application/zip',
        ].join(',')}
        onChange={handleChange}
        disabled={disabled || isUploading}
      />

      {/* ── Trigger button ────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => state.status === 'idle' && inputRef.current?.click()}
        disabled={disabled || isUploading}
        title={`Attach file (max ${MAX_FILE_SIZE / 1024 / 1024} MB)`}
        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border transition-all ${
          isUploading
            ? 'border-gold-400/40 bg-gold-400/10 cursor-wait'
            : state.status === 'error'
            ? 'border-red-500/40 bg-red-500/10 cursor-pointer'
            : 'border-[#2a2a2a] bg-[#161616] hover:border-gold-400/40 hover:bg-gold-400/10 cursor-pointer'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {isUploading ? (
          <Loader2 className="h-4 w-4 animate-spin text-gold-400" />
        ) : state.status === 'error' ? (
          <AlertCircle className="h-4 w-4 text-red-400" />
        ) : (
          <Paperclip className="h-4 w-4 text-[#666] group-hover:text-gold-400 transition-colors" />
        )}
      </button>

      {/* ── Floating status card ──────────────────────────────────────── */}
      <AnimatePresence>
        {state.status !== 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="absolute bottom-full mb-2 right-0 z-50 w-64 rounded-xl border border-[#2a2a2a] bg-[#111] shadow-glass p-3"
          >
            {/* Header row */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                {preview && (
                  <FileTypeIcon
                    contentType={preview.type}
                    className="h-4 w-4 text-gold-400 shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white truncate">
                    {preview?.name ?? 'Uploading…'}
                  </p>
                  {preview && (
                    <p className="text-[10px] text-[#555]">{formatFileSize(preview.size)}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={reset}
                className="text-[#555] hover:text-white transition-colors flex-shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Progress bar (uploading) */}
            {state.status === 'uploading' && (
              <div className="space-y-1">
                <div className="h-1 w-full rounded-full bg-[#2a2a2a] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-gold-400 to-amber-500"
                    initial={{ width: '0%' }}
                    animate={{ width: `${state.progress}%` }}
                    transition={{ ease: 'linear', duration: 0.15 }}
                  />
                </div>
                <p className="text-[10px] text-[#666]">{state.progress}% uploaded</p>
              </div>
            )}

            {/* Validating */}
            {state.status === 'validating' && (
              <p className="text-[10px] text-[#666] flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Validating…
              </p>
            )}

            {/* Success */}
            {state.status === 'success' && (
              <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> File attached!
              </p>
            )}

            {/* Error */}
            {state.status === 'error' && (
              <p className="text-[10px] text-red-400 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {state.message}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
