import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-interface',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-mono-face',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_ORIGIN ?? 'http://localhost:3000'),
  title: 'BOSS Market Evidence Inspector',
  description: 'An inspectable, evidence-grounded Problem 1 prototype for the frozen Lakeview acquisition case.',
  openGraph: {
    title: 'BOSS Market Evidence Inspector',
    description: 'Inspectable evidence. Conditional confidence. Human-owned decisions.',
    images: [{ url: '/og.png', width: 1536, height: 1024, alt: 'BOSS Market Evidence Inspector' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BOSS Market Evidence Inspector',
    description: 'Inspectable evidence. Conditional confidence. Human-owned decisions.',
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
