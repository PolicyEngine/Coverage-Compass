import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import GoogleAnalytics from "@/components/GoogleAnalytics";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/us/coverage-compass";
const assetPath = (path: `/${string}`) => `${basePath}${path}`;

export const metadata: Metadata = {
  metadataBase: new URL("https://coverage-compass.policyengine.org"),
  title: "Coverage Compass | PolicyEngine",
  description:
    "See how life events like income changes, pregnancy, or losing employer coverage affect your ACA marketplace premiums, Medicaid eligibility, and CHIP. Model your household free with PolicyEngine.",
  icons: {
    icon: [{ url: assetPath("/icon.svg"), type: "image/svg+xml" }],
    shortcut: assetPath("/icon.svg"),
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Coverage Compass | PolicyEngine",
    description:
      "See how life events like income changes, pregnancy, or losing employer coverage affect your ACA marketplace premiums, Medicaid eligibility, and CHIP. Model your household free with PolicyEngine.",
    type: "website",
    url: "/",
    images: [
      {
        url: assetPath("/og-image.png"),
        width: 1200,
        height: 630,
        alt: "Coverage Compass — see how life events change your healthcare coverage",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Coverage Compass | PolicyEngine",
    description:
      "See how life events like income changes, pregnancy, or losing employer coverage affect your ACA marketplace premiums, Medicaid eligibility, and CHIP.",
    images: [assetPath("/og-image.png")],
  },
  other: {
    "theme-color": "#319795",
  },
  robots: {
    index: true,
    follow: true,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Coverage Compass",
  description:
    "See how life events like income changes, pregnancy, or losing employer coverage affect your ACA marketplace premiums, Medicaid eligibility, and CHIP.",
  url: "https://coverage-compass.policyengine.org",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  creator: {
    "@type": "Organization",
    name: "PolicyEngine",
    url: "https://policyengine.org",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <GoogleAnalytics />
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
