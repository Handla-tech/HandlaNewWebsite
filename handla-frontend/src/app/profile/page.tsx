'use client';

/**
 * /profile — universal profile page.
 *
 * Behaviour:
 *   • Default                 → view + edit OWN profile (any authenticated user).
 *   • /profile?userId=<uuid>  → view + edit ANOTHER user's profile (ADMIN only;
 *                                backend enforces this via ProfilesController.assertSelfOrAdmin).
 *
 * Supports:
 *   - Avatar upload (presigned S3 PUT, then PATCH /profiles/me with avatarUrl).
 *   - Edit name, email, bio, phone, job title, company, location.
 *   - Shows role + creation date as read-only metadata.
 */

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Camera, Loader2, ArrowLeft, Check, AlertCircle } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import { profilesApi } from '@/lib/api';
import { safeUploadAvatar } from '@/lib/avatar-uploader';
import { useAuthStore } from '@/store/authStore';
import { getErrorMessage } from '@/lib/utils';
import type { User } from '@/types';

interface ProfileForm {
  name:        string;
  email:       string;
  bio:         string;
  phoneNumber: string;
  jobTitle:    string;
  company:     string;
  location:    string;
}

const emptyForm: ProfileForm = {
  name: '', email: '', bio: '', phoneNumber: '',
  jobTitle: '', company: '', location: '',
};

function ProfilePageInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const targetUserId = searchParams.get('userId'); // null → own profile
  const currentUser  = useAuthStore((s) => s.user);
  const setUser      = useAuthStore((s) => s.setUser);

  const [profile,     setProfile]     = useState<User | null>(null);
  const [form,        setForm]        = useState<ProfileForm>(emptyForm);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [uploadPct,   setUploadPct]   = useState(0);
  const [success,     setSuccess]     = useState<string | null>(null);
  const [error,       setError]       = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // True when an ADMIN is editing someone else's profile via ?userId
  const isAdminViewingOther =
    !!targetUserId &&
    !!currentUser &&
    currentUser.id !== targetUserId &&
    currentUser.role === 'ADMIN';

  // True when this is "edit my own profile" (no userId in URL, or it equals me)
  const isOwnProfile = !targetUserId || (currentUser?.id === targetUserId);

  // ─── Load profile ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = targetUserId
          ? await profilesApi.getOne(targetUserId)
          : await profilesApi.getMe();
        const fetched: User = res.data?.data?.profile ?? res.data?.profile ?? res.data;
        if (cancelled) return;
        setProfile(fetched);
        setForm({
          name:        fetched.name        ?? '',
          email:       fetched.email       ?? '',
          bio:         fetched.bio         ?? '',
          phoneNumber: fetched.phoneNumber ?? '',
          jobTitle:    fetched.jobTitle    ?? '',
          company:     fetched.company     ?? '',
          location:    fetched.location    ?? '',
        });
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [targetUserId]);

  // ─── Save handler ──────────────────────────────────────────────────────────
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        name:        form.name.trim(),
        email:       form.email.trim(),
        bio:         form.bio.trim()         || null,
        phoneNumber: form.phoneNumber.trim() || null,
        jobTitle:    form.jobTitle.trim()    || null,
        company:     form.company.trim()     || null,
        location:    form.location.trim()    || null,
      };
      const res = isOwnProfile
        ? await profilesApi.updateMe(payload)
        : await profilesApi.update(profile.id, payload);
      const updated: User = res.data?.data?.profile ?? res.data?.profile ?? res.data;
      setProfile(updated);
      if (isOwnProfile && currentUser) {
        // Sync auth store so navbar / chat avatars refresh immediately.
        setUser({ ...currentUser, ...updated });
      }
      setSuccess('Profile updated successfully.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  // ─── Avatar upload handler (own profile only — backend constraint) ──────────
  async function handleAvatarSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    if (!isOwnProfile) {
      setError('Avatar uploads must be done by the user themselves.');
      return;
    }

    setUploading(true);
    setUploadPct(0);
    setError(null);
    setSuccess(null);

    const { result, error: uploadErr } = await safeUploadAvatar({
      file,
      onProgress: setUploadPct,
    });

    if (uploadErr) {
      setError(uploadErr);
    } else if (result) {
      setProfile(result.profile);
      if (currentUser) setUser({ ...currentUser, ...result.profile });
      setSuccess('Profile picture updated.');
    }
    setUploading(false);
    setUploadPct(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="h-8 w-8 animate-spin text-gold-400" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a] text-white">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-rose-400" />
          <p className="font-medium">Profile not found.</p>
          {error && <p className="mt-2 text-sm text-[#888]">{error}</p>}
          <Link href="/dashboard" className="mt-4 inline-block text-sm text-gold-400 hover:underline">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between gap-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-[#888] hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <h1 className="text-xl font-bold sm:text-2xl">
            {isOwnProfile ? 'My Profile' : 'Edit User Profile'}
          </h1>
          <div className="w-12" />
        </div>

        {/* Admin-editing-another notice */}
        {isAdminViewingOther && (
          <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            You are editing another user&rsquo;s profile as <strong>ADMIN</strong>.
            They will see these changes immediately.
          </div>
        )}

        {/* Flash messages */}
        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            <Check className="h-4 w-4" />
            {success}
          </div>
        )}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* Avatar block */}
        <div className="mb-8 flex flex-col items-center gap-4 rounded-2xl border border-[#1f1f1f] bg-[#0f0f0f] p-6">
          <Avatar user={profile} size="xl" />
          <div className="text-center">
            <p className="text-lg font-semibold">{profile.name}</p>
            <p className="text-xs text-[#888]">{profile.role} · {profile.email}</p>
          </div>
          {isOwnProfile && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleAvatarSelected}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 rounded-lg border border-gold-400/30 bg-gold-400/10 px-4 py-2 text-sm font-medium text-gold-300 hover:bg-gold-400/20 disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading… {uploadPct}%
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4" />
                    {profile.avatarUrl ? 'Change photo' : 'Upload photo'}
                  </>
                )}
              </button>
              <p className="text-[10px] text-[#666]">
                JPEG, PNG, WEBP, GIF — max 5 MB.
              </p>
            </>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="space-y-4 rounded-2xl border border-[#1f1f1f] bg-[#0f0f0f] p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <input
                type="text"
                required
                maxLength={100}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                required
                maxLength={255}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Phone number">
              <input
                type="tel"
                maxLength={32}
                value={form.phoneNumber}
                onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                className={inputClass}
                placeholder="+1 555 000 0000"
              />
            </Field>
            <Field label="Job title">
              <input
                type="text"
                maxLength={120}
                value={form.jobTitle}
                onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                className={inputClass}
                placeholder="e.g. Software Engineer"
              />
            </Field>
            <Field label="Company">
              <input
                type="text"
                maxLength={120}
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Location">
              <input
                type="text"
                maxLength={120}
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className={inputClass}
                placeholder="City, Country"
              />
            </Field>
          </div>
          <Field label="Bio">
            <textarea
              rows={3}
              maxLength={500}
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              className={inputClass + ' resize-none'}
              placeholder="Tell us a bit about yourself…"
            />
            <p className="mt-1 text-[10px] text-[#666]">{form.bio.length}/500</p>
          </Field>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-gold-400 px-5 py-2.5 text-sm font-semibold text-black hover:bg-gold-300 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const inputClass =
  'w-full rounded-lg border border-[#2a2a2a] bg-[#141414] px-3 py-2 text-sm text-white placeholder:text-[#555] focus:border-gold-400/50 focus:outline-none focus:ring-1 focus:ring-gold-400/30 transition-colors';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-[#aaa]">{label}</span>
      {children}
    </label>
  );
}

// ─── Page wrapper (Suspense required for useSearchParams in App Router) ─────

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#0a0a0a]">
          <Loader2 className="h-8 w-8 animate-spin text-gold-400" />
        </div>
      }
    >
      <ProfilePageInner />
    </Suspense>
  );
}
