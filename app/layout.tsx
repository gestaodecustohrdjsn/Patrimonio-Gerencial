import './globals.css';
import type { Metadata } from 'next';
import { Syne, DM_Sans } from 'next/font/google';

const syne = Syne({ 
  subsets: ['latin'],
  variable: '--font-syne',
  display: 'swap',
});

const dmSans = DM_Sans({ 
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Patrimonium - Gestão de Patrimônio Hospitalar',
  description: 'Sistema completo de gestão de patrimônio hospitalar com mapa interativo, QR codes e controle de manutenções',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={`${syne.variable} ${dmSans.variable} font-body bg-bg text-text-pri antialiased`}>
        {children}
      </body>
    </html>
  );
}