// src/components/MainLayout.tsx
"use client"; 

import React from 'react';
import { useAuth } from '@/context/AuthContext'; // 1. Importa o nosso hook
import { Button } from './ui/button';
import { auth } from '@/lib/firebase';
import { LogOut } from 'lucide-react';
import Link from 'next/link'; // 2. Importa o Link do Next.js

// 3. Define a estrutura dos links
const menuItens = [
  { nome: 'Dashboard', href: '/', adminOnly: false },
  { nome: 'Ordens de Serviço', href: '/os', adminOnly: false },
  { nome: 'Frente de Caixa', href: '/caixa', adminOnly: false }, // Já vamos deixar o link pronto
  { nome: 'Clientes', href: '/clientes', adminOnly: true }, // <-- SÓ ADMIN
  { nome: 'Produtos (Peças)', href: '/produtos', adminOnly: true }, // <-- SÓ ADMIN
  { nome: 'Gerenciar Usuários', href: '/usuarios', adminOnly: true }, // <-- SÓ ADMIN
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  
  // 4. Pega os dados do usuário, incluindo o "role"
  const { userData } = useAuth();
  const isAdmin = userData?.role === 'admin';

  return (
    <div className="flex h-screen bg-gray-100">
      {/* ===== SIDEBAR (MENU LATERAL) ===== */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-5 text-2xl font-bold text-center border-b border-gray-700">
          OficinaControl
        </div>
        <nav className="flex-1 p-4 space-y-2">
          
          {/* 5. LÓGICA PARA FILTRAR O MENU */}
          {menuItens.map((item) => {
            // Se o item NÃO for "adminOnly", mostra para todo mundo
            if (!item.adminOnly) {
              return (
                <Link
                  key={item.nome}
                  href={item.href}
                  className="block px-4 py-2 rounded text-lg hover:bg-gray-700 transition-colors"
                >
                  {item.nome}
                </Link>
              );
            }
            
            // Se o item FOR "adminOnly" E o usuário FOR "admin", mostra
            if (item.adminOnly && isAdmin) {
              return (
                <Link
                  key={item.nome}
                  href={item.href}
                  className="block px-4 py-2 rounded text-lg hover:bg-gray-700 transition-colors"
                >
                  {item.nome}
                </Link>
              );
            }

            // Se não for nenhum dos casos acima (item de admin, usuário não é admin), não renderiza nada
            return null;
          })}
        </nav>

        {/* --- Botão de Logout --- */}
        <div className='p-4 border-t border-gray-700'>
          <p className='text-sm text-gray-400 mb-2'>Logado como: {userData?.nome}</p>
          <Button 
            variant="destructive" 
            className='w-full'
            onClick={() => auth.signOut()}
          >
            <LogOut className='mr-2 h-4 w-4' />
            Sair
          </Button>
        </div>
      </aside>

      {/* ===== ÁREA DE CONTEÚDO PRINCIPAL ===== */}
      <main className="flex-1 p-8 overflow-auto">
        {children} 
      </main>
    </div>
  );
}