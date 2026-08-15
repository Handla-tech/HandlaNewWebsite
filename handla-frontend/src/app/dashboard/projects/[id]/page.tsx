'use client';

/**
 * Client-facing Project Detail Page (/dashboard/projects/[id])
 * Read-only view: overview + task list for the authenticated CLIENT.
 */

import { useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  FolderOpen,
  ChevronLeft,
  Clock,
  CheckCircle2,
  PauseCircle,
  XCircle,
  Calendar,
  Loader2,
  AlertCircle,
  CheckSquare,
  Circle,
  Upload,
  Paperclip,
  X as XIcon,
  FileText,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { projectsApi, tasksApi, chatApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Project, ProjectStatus, Task, TaskAttachment } from '@/types';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  PLANNING:  'border-blue-400/30    bg-blue-400/10    text-blue-400',
  ACTIVE:    'border-emerald-400/30 bg-emerald-400/10 text-emerald-400',
  ON_HOLD:   'border-amber-400/30   bg-amber-400/10   text-amber-400',
  COMPLETED: 'border-purple-400/30  bg-purple-400/10  text-purple-400',
  CANCELLED: 'border-red-400/30     bg-red-400/10     text-red-400',
};

const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  PLANNING:  Clock,
  ACTIVE:    CheckCircle2,
  ON_HOLD:   PauseCircle,
  COMPLETED: CheckCircle2,
  CANCELLED: XCircle,
};

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-6 w-48 rounded bg-[#1e1e1e]" />
      <div className="h-4 w-full rounded bg-[#1a1a1a]" />
      <div className="h-4 w-3/4 rounded bg-[#1a1a1a]" />
      <div className="mt-6 space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-12 rounded-xl bg-[#1a1a1a]" />
        ))}
      </div>
    </div>
  );
}

// ─── Client Task Card (client can upload files + submit) ──────────────────────

function apiErrMsg(err: unknown, fallback: string): string {
  const msg = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  return typeof msg === 'string' ? msg : fallback;
}

function ClientTaskCard({ task, projectId }: { task: Task; projectId: string }) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState('');
  const [uploadPct, setUploadPct] = useState(0);
  const [err, setErr] = useState('');

  const isDone = task.status === 'COMPLETED';

  const submit = useMutation({
    mutationFn: async () => {
      setErr('');
      // Upload each selected file to S3 via a presigned URL, collecting metadata.
      const attachments: TaskAttachment[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const presignedRes = await chatApi.getPresignedUrl({
          fileName: f.name, contentType: f.type, fileSize: f.size,
        });
        const presigned = (presignedRes.data?.data ?? presignedRes.data) as { url: string; fileUrl: string };
        await axios.put(presigned.url, f, {
          headers: { 'Content-Type': f.type },
          onUploadProgress: (e) => {
            if (e.total) {
              const perFile = (e.loaded / e.total) * (100 / files.length);
              setUploadPct(Math.round((i * 100) / files.length + perFile));
            }
          },
        });
        attachments.push({ url: presigned.fileUrl, name: f.name, size: f.size, uploadedAt: new Date().toISOString() });
      }
      return tasksApi.submitClientTask(task.id, { attachments, note: note || undefined });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard-project-tasks', projectId] });
      setFiles([]); setNote(''); setUploadPct(0);
    },
    onError: (e) => setErr(apiErrMsg(e, 'Failed to submit')),
  });

  const canSubmit = !task.requiresUpload || files.length > 0;

  return (
    <div className={cn(
      'rounded-xl border px-4 py-3',
      isDone ? 'border-emerald-400/20 bg-emerald-400/5' : 'border-[#fbbf24]/30 bg-[#fbbf24]/[0.06]',
    )}>
      <div className="flex items-start gap-3">
        {isDone
          ? <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
          : <Upload className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#fbbf24]" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={cn('text-sm font-medium', isDone ? 'text-[#888]' : 'text-white')}>{task.title}</p>
            <span className="rounded-full border border-[#fbbf24]/30 bg-[#fbbf24]/10 px-2 py-0.5 text-[10px] font-medium text-[#fbbf24]">
              For you
            </span>
          </div>
          {task.description && <p className="mt-1 text-xs text-[#999] whitespace-pre-wrap">{task.description}</p>}
          {task.dueDate && <p className="mt-1 text-[10px] text-[#666]">Due {formatDate(task.dueDate)}</p>}

          {/* Already-submitted files */}
          {task.attachments && task.attachments.length > 0 && (
            <div className="mt-2 space-y-1">
              {task.attachments.map((a, i) => (
                <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-emerald-400 hover:underline">
                  <FileText className="h-3 w-3" /> {a.name}
                </a>
              ))}
            </div>
          )}

          {/* Submit UI — hidden once completed */}
          {!isDone && (
            <div className="mt-3 space-y-2">
              {files.length > 0 && (
                <div className="space-y-1">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] px-2.5 py-1.5">
                      <span className="flex items-center gap-1.5 text-xs text-white/70 truncate">
                        <Paperclip className="h-3 w-3 flex-shrink-0" /> {f.name}
                      </span>
                      <button onClick={() => setFiles(files.filter((_, j) => j !== i))}
                        className="text-white/30 hover:text-white flex-shrink-0"><XIcon className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}

              <input ref={fileInputRef} type="file" multiple className="hidden"
                onChange={(e) => { if (e.target.files) setFiles([...files, ...Array.from(e.target.files)]); e.target.value = ''; }} />

              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                placeholder="Add a note (optional)…"
                className="w-full rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] px-3 py-2 text-xs text-white placeholder:text-[#555] focus:border-[#fbbf24]/40 focus:outline-none resize-none" />

              {err && <p className="text-xs text-red-400">{err}</p>}
              {submit.isPending && uploadPct > 0 && (
                <div className="h-1 w-full overflow-hidden rounded-full bg-[#1a1a1a]">
                  <div className="h-full bg-[#fbbf24] transition-all" style={{ width: `${uploadPct}%` }} />
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => fileInputRef.current?.click()} disabled={submit.isPending}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-[#2a2a2a] px-3 py-2 text-xs font-medium text-white/70 hover:bg-white/5 transition-colors disabled:opacity-50">
                  <Paperclip className="h-3.5 w-3.5" /> Attach files
                </button>
                <button onClick={() => submit.mutate()} disabled={submit.isPending || !canSubmit}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#fbbf24] px-3 py-2 text-xs font-semibold text-black hover:bg-[#f59e0b] transition-colors disabled:opacity-50">
                  {submit.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  {submit.isPending ? 'Submitting…' : 'Submit'}
                </button>
              </div>
              {task.requiresUpload && files.length === 0 && (
                <p className="text-[10px] text-[#777]">A file upload is required to complete this task.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClientProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const { data: project, isLoading, isError } = useQuery<Project>({
    queryKey: ['dashboard-project', id],
    queryFn: () => projectsApi.getProject(id).then(r => {
      const d = r.data?.data ?? r.data;
      return (d?.project ?? d) as Project;
    }),
    enabled: !!id && !!user,
    staleTime: 30_000,
    retry: 1,
  });

  // Tasks are NOT eagerly loaded on the project endpoint — fetch them
  // separately via the project-scoped task endpoint, which the backend
  // permits for CLIENT users (provided the project belongs to their
  // linked client record).
  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ['dashboard-project-tasks', id],
    queryFn: () => tasksApi.getTasksByProject(id).then(r => {
      const d = r.data?.data ?? r.data;
      return (d?.tasks ?? d ?? []) as Task[];
    }),
    enabled: !!id && !!user,
    staleTime: 30_000,
    retry: 1,
  });

  return (
    <div className="flex h-full flex-col bg-[#0a0a0a]">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 border-b border-[#1e1e1e] px-4 py-4">
        <button
          type="button"
          onClick={() => router.push('/dashboard?tab=projects')}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#555] hover:bg-[#1a1a1a] hover:text-white transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <FolderOpen className="h-4 w-4 text-[#fbbf24] flex-shrink-0" />
          <h1 className="truncate text-sm font-semibold text-white">
            {isLoading ? 'Loading…' : (project?.title ?? 'Project')}
          </h1>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {isLoading && <Skeleton />}

        {isError && (
          <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
            <AlertCircle className="h-8 w-8 text-red-400" />
            <p className="text-sm text-red-400">Failed to load project.</p>
            <button
              onClick={() => router.push('/dashboard?tab=projects')}
              className="text-xs text-white/50 hover:text-white transition-colors"
            >
              ← Back to projects
            </button>
          </div>
        )}

        {project && !isLoading && (
          <div className="p-5 space-y-5">
            {/* Status + badge row */}
            <div className="flex flex-wrap items-center gap-2">
              {(() => {
                const Icon = STATUS_ICON[project.status] ?? Clock;
                return (
                  <span className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold',
                    STATUS_BADGE[project.status],
                  )}>
                    <Icon className="h-3 w-3" />
                    {project.status.replace('_', ' ')}
                  </span>
                );
              })()}
            </div>

            {/* Description */}
            {project.description && (
              <p className="text-sm text-[#aaa] leading-relaxed">{project.description}</p>
            )}

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Calendar className="h-3.5 w-3.5 text-[#555]" />
                  <p className="text-[10px] uppercase tracking-wide text-[#555]">Start Date</p>
                </div>
                <p className="text-sm font-medium text-white">{formatDate(project.startDate)}</p>
              </div>
              <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Calendar className="h-3.5 w-3.5 text-[#555]" />
                  <p className="text-[10px] uppercase tracking-wide text-[#555]">End Date</p>
                </div>
                <p className="text-sm font-medium text-white">{formatDate(project.endDate)}</p>
              </div>
            </div>

            {/* Action Items assigned TO the client (upload files etc.) */}
            {(() => {
              const clientTasks = tasks.filter((t) => t.assignedToClient);
              const internalTasks = tasks.filter((t) => !t.assignedToClient);
              return (
                <>
                  {clientTasks.length > 0 && (
                    <div>
                      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#fbbf24]">
                        Action Required ({clientTasks.length})
                      </h2>
                      <div className="space-y-2">
                        {clientTasks.map((task) => (
                          <ClientTaskCard key={task.id} task={task} projectId={id} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Internal project tasks — read-only progress view */}
                  <div>
                    <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#555]">
                      Tasks {internalTasks.length > 0 && `(${internalTasks.length})`}
                    </h2>
                    {internalTasks.length === 0 ? (
                      <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] px-4 py-6 text-center">
                        <CheckSquare className="mx-auto mb-2 h-6 w-6 text-[#333]" />
                        <p className="text-xs text-[#555]">No tasks yet</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {internalTasks.map((task: Task) => (
                          <div
                            key={task.id}
                            className="flex items-start gap-3 rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] px-4 py-3"
                          >
                            {task.status === 'COMPLETED' ? (
                              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                            ) : (
                              <Circle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#444]" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className={cn(
                                'text-sm font-medium',
                                task.status === 'COMPLETED' ? 'text-[#666] line-through' : 'text-white',
                              )}>
                                {task.title}
                              </p>
                              {task.description && (
                                <p className="mt-0.5 text-xs text-[#555] line-clamp-2">{task.description}</p>
                              )}
                              {task.dueDate && (
                                <p className="mt-1 text-[10px] text-[#444]">
                                  Due {formatDate(task.dueDate)}
                                </p>
                              )}
                            </div>
                            <span className={cn(
                              'flex-shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium',
                              task.status === 'COMPLETED'
                                ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400'
                                : task.status === 'IN_PROGRESS'
                                ? 'border-blue-400/30 bg-blue-400/10 text-blue-400'
                                : 'border-[#333] bg-[#111] text-[#666]',
                            )}>
                              {task.status?.replace('_', ' ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
