import type { Metadata } from 'next';
import MatjaryStore from '../MatjaryStore';

export const metadata: Metadata = {
  title: 'Matjary Storefront — Demo | Handla',
  description: 'View-only demo of the Matjary customer storefront.',
};

export default function Page() {
  return <MatjaryStore />;
}
