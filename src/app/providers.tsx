'use client';
import { Provider } from 'react-redux';
import { store } from '@/lib/store/Index';
import { MantineProvider } from '@mantine/core';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider>
      <Provider store={store}>
        {children}
      </Provider>
    </MantineProvider>
  );
}