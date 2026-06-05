'use client';

/**
 * DropdownPortal — renders dropdown menus at the viewport level via React portal.
 *
 * WHY THIS EXISTS:
 * The ERP layout has multiple overflow:hidden / overflow:auto containers stacked
 * in the component tree (root div, content column div, main, inner scroll div).
 * Any element with overflow:hidden or overflow:auto creates a new stacking/clipping
 * context. A `position:absolute` child — no matter how high its z-index — is
 * clipped to the nearest overflow container.
 *
 * Additionally, `backdrop-filter` (used on the header) creates a new stacking
 * context that traps position:absolute children so they cannot appear above it.
 *
 * SOLUTION:
 * Render the dropdown into document.body via createPortal, using position:fixed
 * with coordinates computed from the trigger button's getBoundingClientRect().
 * This completely escapes all ancestor stacking/clipping contexts.
 *
 * USAGE:
 *   const { triggerRef, isOpen, toggle, close, dropdownStyle } = useDropdown();
 *
 *   <div ref={triggerRef} className="relative">
 *     <button onClick={toggle}>Open</button>
 *     <DropdownPortal isOpen={isOpen} style={dropdownStyle} onClose={close}>
 *       <div>Menu items...</div>
 *     </DropdownPortal>
 *   </div>
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface DropdownStyle {
  top: number;
  right?: number;
  left?: number;
}

export function useDropdown(align: 'left' | 'right' = 'right') {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<DropdownStyle>({ top: 0, right: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  const computePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    if (align === 'right') {
      setDropdownStyle({
        top:   rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    } else {
      setDropdownStyle({
        top:  rect.bottom + 4,
        left: rect.left,
      });
    }
  }, [align]);

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      if (!prev) computePosition();
      return !prev;
    });
  }, [computePosition]);

  const close = useCallback(() => setIsOpen(false), []);
  const open  = useCallback(() => { computePosition(); setIsOpen(true); }, [computePosition]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        // Also allow clicks inside the portal (they're outside triggerRef but inside the dropdown)
        // We handle this by checking data-dropdown-portal attribute
        const target = e.target as HTMLElement;
        if (!target.closest('[data-dropdown-portal]')) {
          setIsOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen]);

  // Recompute on scroll/resize
  useEffect(() => {
    if (!isOpen) return;
    const handler = () => computePosition();
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
    };
  }, [isOpen, computePosition]);

  return { triggerRef, isOpen, toggle, open, close, dropdownStyle };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface DropdownPortalProps {
  isOpen:  boolean;
  style:   DropdownStyle;
  onClose: () => void;
  width?:  number | string;
  children: React.ReactNode;
}

export function DropdownPortal({
  isOpen,
  style,
  onClose: _onClose,
  width = 176,  // 44 * 4 = 176px (w-44)
  children,
}: DropdownPortalProps) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          data-dropdown-portal
          initial={{ opacity: 0, scale: 0.95, y: -4 }}
          animate={{ opacity: 1, scale: 1,    y: 0  }}
          exit={{   opacity: 0, scale: 0.95, y: -4  }}
          transition={{ duration: 0.12, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            top:      style.top,
            right:    style.right,
            left:     style.left,
            width:    typeof width === 'number' ? `${width}px` : width,
            zIndex:   9999,
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
