import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sistema Interno ISP',
  description: 'Sistema interno para gestão operacional de provedor de internet.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head><meta charSet="utf-8" /></head>
      <body>{children}</body>
    </html>
  );
}
