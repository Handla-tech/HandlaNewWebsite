import type { Metadata } from 'next';
import ManarahDemo from './ManarahDemo';

export const metadata: Metadata = {
  title: 'Manarah — Live Demo | Handla',
  description: 'View-only interactive demo of the Manarah school management system.',
};

export default function Page() {
  return <ManarahDemo />;
}
