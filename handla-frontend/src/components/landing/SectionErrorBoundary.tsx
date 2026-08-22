'use client';

import { Component, type ReactNode } from 'react';

/**
 * SectionErrorBoundary — isolates a single landing section.
 *
 * Why this exists:
 *   The public landing page is composed of several independent, client-only
 *   sections (Projects, Products, Testimonials, Contact). Without a boundary,
 *   an uncaught render/hydration error in ANY one of them (e.g. a Framer Motion
 *   hydration hiccup, a transient bad value, a browser-extension DOM mutation)
 *   bubbles to the React root and unmounts the ENTIRE page tree — leaving only
 *   the server-rendered navbar and a blank <main>. That is the exact "empty
 *   section / empty page" symptom users report on some browsers/networks even
 *   though the API and data are perfectly fine.
 *
 *   With a boundary per section, a crash is contained to that one section:
 *   every other section keeps rendering, and we log the real error to the
 *   console so it can be diagnosed instead of silently blanking.
 *
 * Behaviour:
 *   - On error we render `fallback` (default: nothing — the section simply
 *     hides, matching the "no fabricated content" policy) and log details.
 */

interface Props {
  children: ReactNode;
  /** What to render if this section throws. Defaults to null (hidden). */
  fallback?: ReactNode;
  /** Human label used in the console error for easier triage. */
  name?: string;
}

interface State {
  hasError: boolean;
}

export class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // Surface the real cause instead of a silent blank page.
    // eslint-disable-next-line no-console
    console.error(
      `[SectionErrorBoundary] "${this.props.name ?? 'section'}" crashed and was isolated:`,
      error,
      info,
    );
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}

export default SectionErrorBoundary;
