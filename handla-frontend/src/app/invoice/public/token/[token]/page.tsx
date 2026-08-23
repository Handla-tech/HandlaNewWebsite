'use client';

/**
 * INFO-01 canonical public invoice route — opaque capability token.
 *
 *   URL pattern: /invoice/public/token/:token
 *   Endpoint:    GET /erp/invoices/public/token/:token (Nest @Public())
 *
 * This is the route embedded in newly generated share links / QR codes. The
 * token is independent of the invoice's database id, is throttled server-side,
 * and honours revocation (410) / expiry (410). Invalid tokens return 404 with
 * no existence oracle. Inherits noindex/nofollow from ../../layout.tsx.
 */

import { useParams } from 'next/navigation';
import { invoicesApi } from '@/lib/api';
import InvoicePublicView, { type PublicInvoice } from '@/components/public/InvoicePublicView';

export default function PublicInvoiceTokenPage() {
  const { token } = useParams<{ token: string }>();
  return (
    <InvoicePublicView
      load={async () => {
        const res = await invoicesApi.getPublicInvoiceByToken(token);
        return (res.data?.data ?? res.data) as PublicInvoice;
      }}
    />
  );
}
