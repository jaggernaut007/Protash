import React from 'react';
import type { Metadata } from 'next';
import './globals.css';
import PreloadLibs from './PreloadLibs';

export const metadata: Metadata = {
  title: 'Protash — Enterprise Prototyping',
  description: 'Domain-driven enterprise prototype generation in under a minute.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#ffffff" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body className="antialiased font-sans selection:bg-gray-300 selection:text-gray-900 transition-colors duration-500" suppressHydrationWarning>
        <PreloadLibs />
        {children}
      </body>
    </html>
  );
}
