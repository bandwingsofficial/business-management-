import './globals.css';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { appMeta } from '@/lib/app-meta';

export const metadata: Metadata = {
  title: appMeta.name,
  description: appMeta.description,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
