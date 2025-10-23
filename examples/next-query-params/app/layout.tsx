export const metadata = {
  title: '@1apostoli/use-external-state • Next Query Params',
  description: 'Demonstrates useExternalState with @1apostoli/use-external-state/next',
};

import type { ReactNode } from 'react';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'sans-serif', padding: '2rem' }}>{children}</body>
    </html>
  );
}
