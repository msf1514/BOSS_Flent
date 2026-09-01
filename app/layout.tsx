import type { Metadata } from 'next';
import { IBM_Plex_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const interfaceFont = Plus_Jakarta_Sans({
  variable: '--font-interface',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
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
    'A working BOSS market-evidence review for inspectable comparable decisions, collaboration and governed handoff.',
  openGraph: {
    title: 'BOSS Market Evidence Inspector',
    description:
      'From raw listing evidence to a reviewable, frozen market packet.',
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
      'From raw listing evidence to a reviewable, frozen market packet.',
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
