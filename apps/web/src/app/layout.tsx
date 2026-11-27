import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Iskina SME — MSME operations core',
  description:
    'Onboarding, catalog, order and booking processing, storefront themes and analytics for micro, small and medium businesses.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
