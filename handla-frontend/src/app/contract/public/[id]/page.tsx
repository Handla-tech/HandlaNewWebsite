'use client';

/**
 * LEGACY public contract route — raw entity id.
 *
 *   URL pattern: /contract/public/:id
 *   Endpoint:    GET /erp/contracts/public/:id (Nest @Public())
 *
 * INFO-01: transitional compatibility path for links printed/shared before the
 * capability-token migration. Gated on the backend by PUBLIC_DOC_LEGACY_ID_LINKS;
 * when disabled the endpoint returns 404 and this page shows the standard
 * invalid-link message. NEW links use the token route (./token/[token]).
 */

import { useParams } from 'next/navigation';
import { contractsApi } from '@/lib/api';
import ContractPublicView, { type PublicContract } from '@/components/public/ContractPublicView';

export default function PublicContractLegacyPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <ContractPublicView
      load={async () => {
        const res = await contractsApi.getPublicContract(id);
        return (res.data?.data?.contract ?? res.data?.data ?? res.data) as PublicContract;
      }}
    />
  );
}
