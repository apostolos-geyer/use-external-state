'use client';

import type { PropsWithChildren, ReactNode } from 'react';
import { useEffect, useState } from 'react';

export interface ClientOnlyProps {
  children: ReactNode;
}

export function ClientOnly({ children }: PropsWithChildren<ClientOnlyProps>): ReactNode {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => {
      setMounted(false);
    };
  }, []);

  return mounted ? children : null;
}
