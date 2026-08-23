'use client';

/**
 * LEGACY-url-shape public quotation route — token-based.
 *
 *   URL pattern: /quotation/public/:token
 *
 * The quotation model has ALWAYS been token-based (no raw-id public route),
 * so this route is safe; it is retained only for links already in circulation.
 * NEW share links use the canonical /quotation/public/token/:token route
 * (./token/[token]). Both call the same @Public() token endpoints.
 */

import { useParams } from 'next/navigation';
import QuotationPublicView from '@/components/public/QuotationPublicView';

export default function PublicQuotationLegacyPage() {
  const params = useParams();
  const token = String(params?.token ?? '');
  return <QuotationPublicView token={token} />;
}
