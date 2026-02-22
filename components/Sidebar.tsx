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

export default function Sidebar() {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40" onClick={() => setSidebarOpen(false)}>
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75"></div>
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
                  >
                    {item.name}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <div className="flex-1 flex flex-col min-h-0 border-r border-border bg-bg-panel">
          <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
            <div className="flex items-center flex-shrink-0 px-4">
              <Link href="/dashboard" className="font-display text-xl font-bold text-accent">
                PATRIMONIUM
              </Link>
            </div>
            <nav className="mt-5 flex-1 px-2 space-y-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`${
                    pathname === item.href
                      ? 'bg-bg-card text-accent'
                      : 'text-text-sec hover:bg-bg-card hover:text-text-pri'
                  } group flex items-center px-2 py-2 text-sm font-medium rounded-md capitalize`}
                >
                  <span>{item.name}</span>
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </>
  );
}