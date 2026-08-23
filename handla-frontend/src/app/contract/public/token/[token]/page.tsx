'use client';

/**
 * INFO-01 canonical public contract route — opaque capability token.
 *
 *   URL pattern: /contract/public/token/:token
 *   Endpoint:    GET /erp/contracts/public/token/:token (Nest @Public())
 *
 * Embedded in newly generated share links / QR codes. Token is independent of
 * the contract id, throttled, and honours revocation (410) / expiry (410).
 * Invalid tokens return 404 with no existence oracle. Inherits noindex/nofollow
 * from ../../layout.tsx.
 */

import { useParams } from 'next/navigation';
import { contractsApi } from '@/lib/api';
import ContractPublicView, { type PublicContract } from '@/components/public/ContractPublicView';

export default function PublicContractTokenPage() {
  const { token } = useParams<{ token: string }>();
  return (
    <ContractPublicView
      load={async () => {
        const res = await contractsApi.getPublicContractByToken(token);
        return (res.data?.data?.contract ?? res.data?.data ?? res.data) as PublicContract;
      }}
    />
  );
}
