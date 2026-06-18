import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Support Platform Admin",
  description: "Operational dashboard shell for a white-label, multi-tenant AI support platform."
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `
try {
  var storedTheme = window.localStorage.getItem("admin-color-scheme");
  if (storedTheme === "dark" || storedTheme === "light") {
    document.documentElement.dataset.theme = storedTheme;
    document.documentElement.style.colorScheme = storedTheme;
  }
} catch {}
`
          }}
        />
        {children}
      </body>
    </html>
  );
}
