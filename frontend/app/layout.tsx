import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { SiteHeader } from "~/components/site-header";
import { TailwindIndicator } from "~/components/tailwind-indicator";
import { ThemeProvider } from "~/components/theme-provider";
import { ThemeSwitch } from "~/components/theme-switch";
import { Toaster } from "~/components/ui/sonner";
import { TooltipProvider } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { TRPCReactProvider } from "~/trpc/react";
import { unstable_setBasePath } from "~/trpc/query-client";
import "./globals.css";
import "~/lib/dayjs";

export const metadata: Metadata = {
  metadataBase: new URL("https://lndev-inbox.vercel.app"),
  title: {
    default: "ln/dev/inbox — contact me easily",
    template: `%s — ln/dev/inbox`,
  },
  description:
    "send emails, files, schedules, and voice messages effortlessly in one place.",
  openGraph: {
    title: "ln/dev/inbox",
    description:
      "send emails, files, schedules, and voice messages effortlessly in one place.",
    url: "https://lndev-inbox.vercel.app",
    siteName: "ln/dev/inbox",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og.png",
        alt: "ln/dev/inbox — contact me easily",
        width: 1920,
        height: 1080,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ln/dev/inbox",
    description:
      "send emails, files, schedules, and voice messages effortlessly in one place.",
    images: ["/og.png"],
    creator: "@lndev_",
  },
  robots: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
    googleBot: "index, follow",
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

unstable_setBasePath("/trpc");

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          GeistSans.variable,
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider>
            <TRPCReactProvider>
              <div className="relative flex min-h-screen flex-col">
                <SiteHeader />
                <main className="flex-1">{children}</main>
              </div>
              <TailwindIndicator />
            </TRPCReactProvider>
          </TooltipProvider>
          <Toaster />
          <ThemeSwitch />
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-FG3ZK5NHE9"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-FG3ZK5NHE9');
          `}
        </Script>
      </body>
    </html>
  );
}