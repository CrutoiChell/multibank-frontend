import type { Metadata } from "next";
import "./globals.css";
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';

export const metadata: Metadata = {
  title: "Мультибанк",
  description: "Единый интерфейс для всех ваших банков",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <MantineProvider>
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
