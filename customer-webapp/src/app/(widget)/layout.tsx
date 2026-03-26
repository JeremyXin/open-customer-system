import type { Metadata } from 'next';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Support Chat',
  description: 'Customer support chat widget',
};

export default function WidgetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
