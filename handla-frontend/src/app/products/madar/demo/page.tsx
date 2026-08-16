import type { Metadata } from 'next';
import MadarDemo from './MadarDemo';

export const metadata: Metadata = {
  title: 'Madar — Live Demo | Handla',
  description: 'View-only interactive demo of the Madar business management ERP.',
};

export default function Page() {
  return <MadarDemo />;
}
