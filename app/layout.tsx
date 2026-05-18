import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ReviewRadar',
  description: 'GitHub PR Dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var saved = localStorage.getItem('reviewradar-theme');
                var prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
                var theme = saved || (prefersLight ? 'light' : 'dark');
                if (theme === 'light') document.documentElement.classList.add('light-mode');
                else document.documentElement.classList.add('dark-mode');
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
