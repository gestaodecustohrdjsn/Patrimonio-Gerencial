'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'Patrimônios', href: '/assets' },
  { name: 'Centros de Custo', href: '/centers' },
  { name: 'Movimentações', href: '/movements' },
  { name: 'Manutenções', href: '/maintenances' },
  { name: 'Inventário', href: '/inventory' },
  { name: 'Relatórios', href: '/reports' },
];

export default function Header() {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <header className="bg-bg-panel border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Mobile menu button */}
          <button
            type="button"
            className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-text-sec hover:text-text-pri hover:bg-bg-card focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent"
            onClick={() => setSidebarOpen(true)}
          >
            <span className="sr-only">Abrir menu</span>
            <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Link href="/dashboard" className="font-display text-xl font-bold text-accent">
              PATRIMONIUM
            </Link>
          </div>

          {/* Navigation Desktop */}
          <nav className="hidden md:ml-6 md:flex md:space-x-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`${
                  pathname === item.href
                    ? 'border-accent text-accent'
                    : 'border-transparent text-text-sec hover:text-text-pri hover:border-border-hi'
                } capitalize inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
              >
                {item.name}
              </Link>
            ))}
          </nav>

          {/* User profile */}
          <div className="flex items-center">
            <div className="ml-3 relative">
              <div className="bg-bg-card rounded-full p-2">
                <span className="text-text-sec">Usuário</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div 
            className="fixed inset-0 bg-gray-600 bg-opacity-75"
            onClick={() => setSidebarOpen(false)}
          ></div>
          
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-bg-panel">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                type="button"
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent"
                onClick={() => setSidebarOpen(false)}
              >
                <span className="sr-only">Fechar menu</span>
                <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-5 pt-5 pb-4 border-t border-border">
              <div className="flex-shrink-0 flex items-center px-4">
                <Link href="/dashboard" className="font-display text-xl font-bold text-accent">
                  PATRIMONIUM
                </Link>
              </div>
              <nav className="mt-5 px-2 space-y-1">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`${
                      pathname === item.href
                        ? 'bg-bg-card text-accent'
                        : 'text-text-sec hover:bg-bg-card hover:text-text-pri'
                    } group flex items-center px-2 py-2 text-base font-medium rounded-md capitalize`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    {item.name}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}