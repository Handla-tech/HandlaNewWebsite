'use client';

/**
 * INFO-01 canonical public quotation route — opaque capability token.
 *
 *   URL pattern: /quotation/public/token/:token
 *   Endpoints:   GET  /erp/quotations/public/token/:token         (@Public())
 *                POST /erp/quotations/public/token/:token/accept   (@Public())
 *                POST /erp/quotations/public/token/:token/reject   (@Public())
 *
 * Embedded in newly generated share links. Honours revocation (410) / expiry;
 * accept/reject are validated by the quotation state machine BEFORE any state
 * change. Inherits noindex/nofollow from ../../layout.tsx.
 */

import { useParams } from 'next/navigation';
import QuotationPublicView from '@/components/public/QuotationPublicView';

export default function PublicQuotationTokenPage() {
  const { token } = useParams<{ token: string }>();
  return <QuotationPublicView token={String(token ?? '')} />;
}
