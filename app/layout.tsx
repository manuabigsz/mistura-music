import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Archivo, Big_Shoulders } from 'next/font/google';
import './globals.css';

// Fonte variável com eixo de tamanho óptico: em tamanhos grandes ela fica mais condensada, como tipo de madeira.
const display = Big_Shoulders({
  subsets: ['latin'],
  axes: ['opsz'],
  variable: '--font-display',
  display: 'swap',
});

const text = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-text',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Mistura',
  description: 'Monte playlists no Spotify a partir do que você já ouve, com os gêneros que quiser.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${text.variable}`}>
      <body>{children}</body>
    </html>
  );
}
