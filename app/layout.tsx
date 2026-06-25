import type { Metadata } from 'next';
import './globals.css';
import ThemeInitializer from '@/components/ThemeInitializer';

export const metadata: Metadata = {
  title: 'ReviewRadar',
  description: 'GitHub PR Dashboard',
};

const themeScript = `
  (function () {
    try {
      const saved = localStorage.getItem('reviewradar-theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const theme = saved ? saved : prefersDark ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', theme);
    } catch (e) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  })();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning data-theme="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script
          defer
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon='{"token": "19d95e6c5228467a98f77f4972de1789"}'
        />
      </head>
      <body className="min-h-screen">
        <ThemeInitializer />
        {children}
      </body>
    </html>
  );
}
