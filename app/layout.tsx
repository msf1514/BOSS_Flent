import type { Metadata } from 'next';
import { IBM_Plex_Mono, Inter } from 'next/font/google';
import './globals.css';

const interfaceFont = Inter({
  variable: '--font-interface',
  subsets: ['latin'],
});

const plexMono = IBM_Plex_Mono({
  variable: '--font-mono-face',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_ORIGIN ?? 'http://localhost:3000'),
  title: 'BOSS Market Evidence Inspector',
  description:
    'An inspectable, evidence-grounded Problem 1 prototype for the frozen Lakeview acquisition case.',
  openGraph: {
    title: 'BOSS Market Evidence Inspector',
    description:
      'Inspectable evidence. Conditional confidence. Human-owned decisions.',
    images: [
      {
        url: '/og.png',
        width: 1536,
        height: 1024,
        alt: 'BOSS Market Evidence Inspector',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BOSS Market Evidence Inspector',
    description:
      'Inspectable evidence. Conditional confidence. Human-owned decisions.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${interfaceFont.variable} ${plexMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
