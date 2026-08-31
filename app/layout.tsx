import type { Metadata } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import './globals.css';

const plexSans = IBM_Plex_Sans({
  variable: '--font-interface',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const plexMono = IBM_Plex_Mono({
  variable: '--font-mono-face',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
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
      <body className={`${plexSans.variable} ${plexMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
