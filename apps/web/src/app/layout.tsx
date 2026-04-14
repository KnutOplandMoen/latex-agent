import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LaTeX IDE',
  description: 'A collaborative web-based LaTeX editor with AI assistance',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#282c34] text-[#abb2bf] antialiased">{children}</body>
    </html>
  );
}
