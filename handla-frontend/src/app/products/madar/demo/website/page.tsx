import type { Metadata } from 'next';
import MadarWebsite from '../MadarWebsite';

export const metadata: Metadata = {
  title: 'Madar Website — Demo | Handla',
  description: 'View-only demo of the Madar public agency website (portfolio + store).',
};

export default function Page() {
  return <MadarWebsite />;
}
