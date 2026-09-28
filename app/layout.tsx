import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Voice-to-Plan',
  description: 'Speak your day. Get a structured schedule.',
  openGraph: {
    title: 'Voice-to-Plan',
    description: 'Speak your day. Get a structured schedule.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
