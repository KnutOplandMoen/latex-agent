import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export const metadata: Metadata = {
  title: 'LaTeX IDE',
  description: 'A collaborative web-based LaTeX editor with AI assistance',
};

const clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const body = (
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

  if (!clerkEnabled) return body;

  return (
    <ClerkProvider
      appearance={{
        variables: { colorPrimary: '#3b82f6' },
        elements: {
          card: 'bg-[#21252b] border-[#3e4451]',
        },
      }}
    >
      {body}
    </ClerkProvider>
  );
}
