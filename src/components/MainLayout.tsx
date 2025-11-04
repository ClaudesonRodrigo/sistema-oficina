// src/components/MainLayout.tsx
"use client"; 

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from './ui/button';
import { auth } from '@/lib/firebase';
import { LogOut } from 'lucide-react';
import Link from 'next/link'; 
import { z } from '../../node_modules/zod/v4/classic/external.cjs';

// 1. ATUALIZAÇÃO: Adicionado o link "Relatórios"
const menuItens = [
  { nome: 'Dashboard', href: '/', adminOnly: false },
  { nome: 'Ordens de Serviço', href: '/os', adminOnly: false },
  { nome: 'Frente de Caixa', href: '/caixa', adminOnly: false }, 
  { nome: 'Relatórios', href: '/relatorios', adminOnly: true }, // <-- NOVO LINK (SÓ ADMIN)
  { nome: 'Lançar Despesas', href: '/despesas', adminOnly: true },
  { nome: 'Entrada de Estoque', href: '/entrada-estoque', adminOnly: true },
  { nome: 'Clientes', href: '/clientes', adminOnly: true },
  { nome: 'Fornecedores', href: '/fornecedores', adminOnly: true },
  { nome: 'Produtos (Peças)', href: '/produtos', adminOnly: true },
  { nome: 'Gerenciar Usuários', href: '/usuarios', adminOnly: true },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  
  const { userData } = useAuth();
  const isAdmin = userData?.role === 'admin';

  return (
    <div className="flex h-screen bg-gray-100">
      {/* ===== SIDEBAR (MENU LATERAL) ===== */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-5 text-2xl font-bold text-center border-b border-gray-700">
          OficinaControl
        </div>
        {/* Adicionado overflow-y-auto para menus longos */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          
          {menuItens.map((item) => {
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
// --- SCHEMA DO FORMULÁRIO ATUALIZADO ---
export const formSchema = z.object({
  nome: z.string().min(3, { message: "O nome deve ter pelo menos 3 caracteres." }),
  codigoSku: z.string().optional(),
  tipo: z.enum(["peca", "servico"], { required_error: "Selecione o tipo." }),
  precoCusto: z.coerce.number().min(0, { message: "O custo deve ser positivo." }),
  precoVenda: z.coerce.number().min(0, { message: "O preço deve ser positivo." }),
  // Validação para tipo 'peca'
  estoqueAtual: z.coerce.number().int({ message: "O estoque deve ser um número inteiro." }),
}).refine((data) => {
  // Se for 'servico', o estoque não importa (será 0), mas se for 'peca', deve ser >= 0
  if (data.tipo === 'peca') {
    return data.estoqueAtual >= 0;
  }
  return true;
}, {
  message: "Estoque deve ser 0 ou mais para peças.",
  path: ["estoqueAtual"],
});
