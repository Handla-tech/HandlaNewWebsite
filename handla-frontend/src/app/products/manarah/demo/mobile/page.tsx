import type { Metadata } from 'next';
import ManarahMobile from '../ManarahMobile';

export const metadata: Metadata = {
  title: 'Manarah Mobile Apps — Demo | Handla',
  description: 'View-only demo of the Manarah parent and student mobile apps.',
};

export default function Page() {
  return <ManarahMobile />;
}
