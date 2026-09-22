'use client';

import { useEffect } from 'react';

export function ThemeProvider({
  children,
  attribute = 'class',
  defaultTheme = 'dark',
}: {
  children: React.ReactNode;
  attribute?: string;
  defaultTheme?: string;
}) {
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return <>{children}</>;
}
