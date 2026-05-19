export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning>
      <head>
        <script
          defer
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon='{"token": "19d95e6c5228467a98f77f4972de1789"}'
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
