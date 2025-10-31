// src/components/MainLayout.tsx
"use client"; // Necessário para interatividade futura (ex: menu mobile)

import React from 'react';

// Vamos definir os links do menu aqui
const menuItens = [
  { nome: 'Dashboard', href: '/' },
  { nome: 'Ordens de Serviço', href: '/os' },
  { nome: 'Clientes', href: '/clientes' },
  { nome: 'Produtos (Peças)', href: '/produtos' },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-100">
      {/* ===== SIDEBAR (MENU LATERAL) ===== */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-5 text-2xl font-bold text-center border-b border-gray-700">
          OficinaControl
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {menuItens.map((item) => (
            <a
              key={item.nome}
              href={item.href}
              className="block px-4 py-2 rounded text-lg hover:bg-gray-700 transition-colors"
            >
              {item.nome}
            </a>
          ))}
        </nav>
      </aside>

      {/* ===== ÁREA DE CONTEÚDO PRINCIPAL ===== */}
      <main className="flex-1 p-8 overflow-auto">
        {/* As páginas (children) serão renderizadas aqui */}
        {children} 
      </main>
    </div>
  );
}