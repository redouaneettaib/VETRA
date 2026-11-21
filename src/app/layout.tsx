import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VETRA | ONSSA – DPA',
  description:
    'Veille, Traçabilité et Reporting des Activités des Services Vétérinaires',
  icons: {
    icon: [
      { url: '/favicon-32x32.png?v=2', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-192x192.png?v=2', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/favicon.ico?v=2',
    apple: '/apple-touch-icon.png?v=2',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
