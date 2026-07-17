import type { Metadata } from 'next'
import { Bricolage_Grotesque, DM_Sans } from 'next/font/google'
import './globals.css'
import { cn } from '@/lib/utils'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-sans' })

const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-display',
})

export const metadata: Metadata = {
  title: 'GuateOfertas — comparador de precios de Guatemala',
  description:
    'Compará precios de consolas, GPUs y celulares entre MAX, Kemik, Pacifiko y Curacao antes de comprar.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="es"
      className={cn('h-full', 'antialiased', dmSans.variable, bricolageGrotesque.variable, 'font-sans')}
    >
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <main className="flex flex-1 flex-col">{children}</main>
        <SiteFooter />
      </body>
    </html>
  )
}
