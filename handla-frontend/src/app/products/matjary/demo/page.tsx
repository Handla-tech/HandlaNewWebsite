import type { Metadata } from 'next';
import MatjaryDemo from './MatjaryDemo';

export const metadata: Metadata = {
  title: 'Matjary — Live Demo | Handla',
  description: 'View-only interactive demo of the Matjary commerce platform admin.',
};

export default function Page() {
  return <MatjaryDemo />;
}
