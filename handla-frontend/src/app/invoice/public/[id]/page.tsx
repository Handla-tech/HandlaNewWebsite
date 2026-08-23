'use client';

/**
 * LEGACY public invoice route — raw entity id.
 *
 *   URL pattern: /invoice/public/:id
 *   Endpoint:    GET /erp/invoices/public/:id (Nest @Public())
 *
 * INFO-01: this raw-id route is a TRANSITIONAL compatibility path for links
 * already printed on PDFs / shared before the capability-token migration. It
 * is gated on the backend by PUBLIC_DOC_LEGACY_ID_LINKS; when that flag is
 * disabled the endpoint returns 404 and this page shows the standard
 * invalid-link message. NEW links are the token route (see ./token/[token]).
 */

import { useParams } from 'next/navigation';
import { invoicesApi } from '@/lib/api';
import InvoicePublicView, { type PublicInvoice } from '@/components/public/InvoicePublicView';

export default function PublicInvoiceLegacyPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <InvoicePublicView
      load={async () => {
        const res = await invoicesApi.getPublicInvoice(id);
        return (res.data?.data ?? res.data) as PublicInvoice;
      }}
    />
  );
}
