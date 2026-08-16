import type { Metadata } from 'next';
import MatjaryPos from '../MatjaryPos';

export const metadata: Metadata = {
  title: 'Matjary POS — Demo | Handla',
  description: 'View-only demo of the Matjary in-store point-of-sale (POS) register.',
};

export default function Page() {
  return <MatjaryPos />;
}
