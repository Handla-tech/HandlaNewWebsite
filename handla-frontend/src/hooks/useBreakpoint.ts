'use client';

/**
 * useBreakpoint — SSR-safe responsive breakpoint hook for Handla
 *
 * Returns boolean flags matching Tailwind's default screen breakpoints:
 *   sm  ≥ 640 px
 *   md  ≥ 768 px
 *   lg  ≥ 1024 px
 *   xl  ≥ 1280 px
 *
 * Uses `window.matchMedia` for precise CSS media-query matching.
 * Falls back to `false` during SSR (no window) so hydration is consistent.
 *
 * Usage:
 *   const { isMobile, isTablet, isDesktop } = useBreakpoint();
 *   const { sm, md, lg, xl } = useBreakpoint();
 */

import { useState, useEffect } from 'react';

// ─── Tailwind default breakpoints ────────────────────────────────────────────

const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

type BreakpointKey = keyof typeof BREAKPOINTS;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BreakpointState {
  /** ≥ 640 px */
  sm: boolean;
  /** ≥ 768 px */
  md: boolean;
  /** ≥ 1024 px */
  lg: boolean;
  /** ≥ 1280 px */
  xl: boolean;
  /** < 768 px (no md) */
  isMobile: boolean;
  /** ≥ 768 px and < 1024 px */
  isTablet: boolean;
  /** ≥ 1024 px */
  isDesktop: boolean;
}

// ─── SSR-safe initial state ───────────────────────────────────────────────────

const SSR_STATE: BreakpointState = {
  sm:        false,
  md:        false,
  lg:        false,
  xl:        false,
  isMobile:  true,   // default to mobile-first during SSR
  isTablet:  false,
  isDesktop: false,
};

// ─── Helper — read all breakpoints from matchMedia ───────────────────────────

function readBreakpoints(): BreakpointState {
  if (typeof window === 'undefined') return SSR_STATE;

  const flags = Object.fromEntries(
    (Object.entries(BREAKPOINTS) as [BreakpointKey, number][]).map(
      ([key, px]) => [key, window.matchMedia(`(min-width: ${px}px)`).matches],
    ),
  ) as Record<BreakpointKey, boolean>;

  return {
    ...flags,
    isMobile:  !flags.md,
    isTablet:  flags.md  && !flags.lg,
    isDesktop: flags.lg,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBreakpoint(): BreakpointState {
  // Start with SSR-safe values so server/client HTML matches on first render
  const [state, setState] = useState<BreakpointState>(SSR_STATE);

  useEffect(() => {
    // Set actual values after mount (client only)
    setState(readBreakpoints());

    // Subscribe to each breakpoint's MediaQueryList for real-time updates
    const queries = (
      Object.entries(BREAKPOINTS) as [BreakpointKey, number][]
    ).map(([, px]) => {
      const mql = window.matchMedia(`(min-width: ${px}px)`);
      const handler = () => setState(readBreakpoints());
      mql.addEventListener('change', handler);
      return { mql, handler };
    });

    return () => {
      queries.forEach(({ mql, handler }) => {
        mql.removeEventListener('change', handler);
      });
    };
  }, []);

  return state;
}
