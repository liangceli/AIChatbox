import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getAdminWebConfig } from "./lib/admin-access";
import "./globals.css";

export const metadata: Metadata = {
  title: "Solaris AI | Customer support operations",
  description: "A secure, multi-tenant AI support platform for grounded answers and human handoff."
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  const publishableKey = getAdminWebConfig().clerkPublishableKey;
  const content = (
    <>
      <ThemeBootstrap />
      {children}
    </>
  );

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {publishableKey ? <ClerkProvider publishableKey={publishableKey}>{content}</ClerkProvider> : content}
      </body>
    </html>
  );
}

function ThemeBootstrap() {
  return (
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
  );
}
