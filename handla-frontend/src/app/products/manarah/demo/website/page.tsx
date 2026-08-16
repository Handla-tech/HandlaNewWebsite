import type { Metadata } from 'next';
import ManarahWebsite from '../ManarahWebsite';

export const metadata: Metadata = {
  title: 'Manarah School Website — Demo | Handla',
  description: 'View-only demo of the Manarah public school website.',
};

export default function Page() {
  return <ManarahWebsite />;
}
