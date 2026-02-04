// src/components/MainLayout.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Car, 
  Package, 
  DollarSign, 
  BarChart3, 
  UserCog, 
  LogOut,
  Menu,
  X,
  ClipboardList,
  Truck,
  ArrowDownToLine,
  TrendingDown,
  ShoppingCart // <--- Ícone do PDV
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();
  const { userData, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Lista de Itens do Menu
  const menuItems = [
    {
      href: "/",
      label: "Dashboard",
      icon: LayoutDashboard,
      roles: ["admin", "operador"],
    },
    {
      href: "/os",
      label: "Ordens de Serviço",
      icon: FileText,
      roles: ["admin", "operador"],
    },
    {
      href: "/orcamentos",
      label: "Orçamentos",
      icon: ClipboardList,
      roles: ["admin", "operador"],
    },
    // --- NOVO BOTÃO PDV ---
    {
      href: "/pdv",
      label: "PDV (Venda Rápida)",
      icon: ShoppingCart,
      roles: ["admin", "operador"], // Todo mundo pode vender
      highlight: true // Destaque visual (opcional na lógica abaixo)
    },
    // ----------------------
    {
      href: "/clientes",
      label: "Clientes",
      icon: Users,
      roles: ["admin", "operador"],
    },
    {
      href: "/carros",
      label: "Veículos",
      icon: Car,
      roles: ["admin", "operador"],
    },
    {
      href: "/produtos",
      label: "Estoque / Produtos",
      icon: Package,
      roles: ["admin", "operador"],
    },
    {
      href: "/entrada-estoque",
      label: "Entrada de Estoque",
      icon: ArrowDownToLine,
      roles: ["admin", "operador"],
    },
    {
      href: "/fornecedores",
      label: "Fornecedores",
      icon: Truck,
      roles: ["admin", "operador"],
    },
    {
      href: "/caixa",
      label: "Financeiro / Caixa",
      icon: DollarSign,
      roles: ["admin", "operador"], // Você pode restringir se quiser
    },
    {
      href: "/despesas",
      label: "Despesas",
      icon: TrendingDown,
      roles: ["admin", "operador"],
    },
    {
      href: "/relatorios",
      label: "Relatórios",
      icon: BarChart3,
      roles: ["admin"], // Apenas Admin vê relatórios completos
    },
    {
      href: "/usuarios",
      label: "Usuários",
      icon: UserCog,
      roles: ["admin"], // Apenas Admin gerencia usuários
    },
  ];

  // Filtra itens baseados no cargo do usuário
  const filteredItems = menuItems.filter((item) => 
    userData && item.roles.includes(userData.role)
  );

  return (
    <div className="flex h-screen bg-gray-100">
      
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white h-full">
        <div className="p-6 flex items-center justify-center border-b border-slate-700">
          <h1 className="text-2xl font-bold text-blue-400">Oficina System</h1>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {filteredItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              // Se for PDV, dá um destaque extra
              const isPdv = item.href === "/pdv";
              
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-md transition-colors text-sm font-medium",
                      isActive 
                        ? "bg-blue-600 text-white shadow-lg" 
                        : "text-slate-300 hover:bg-slate-800 hover:text-white",
                      isPdv && !isActive && "text-green-400 hover:bg-green-900/20" // Destaque verde para o PDV quando não ativo
                    )}
                  >
                    <Icon className={cn("h-5 w-5", isPdv && "text-green-400", isActive && "text-white")} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-slate-700">
          <div className="mb-4 px-2">
            <p className="text-sm font-medium text-white">{userData?.nome}</p>
            <p className="text-xs text-slate-400 capitalize">{userData?.role}</p>
          </div>
          <Button 
            variant="destructive" 
            className="w-full flex gap-2"
            onClick={logout}
          >
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </aside>

      {/* Menu Mobile (Overlay) */}
      <div className="md:hidden flex flex-col flex-1">
        <header className="bg-slate-900 text-white p-4 flex justify-between items-center shadow-md">
          <h1 className="text-xl font-bold text-blue-400">Oficina System</h1>
          <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </header>

        {isMobileMenuOpen && (
          <div className="absolute top-16 left-0 w-full bg-slate-900 text-white z-50 p-4 shadow-xl border-t border-slate-700">
            <nav className="flex flex-col gap-2">
              {filteredItems.map((item) => {
                 const Icon = item.icon;
                 const isActive = pathname === item.href;
                 return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-md transition-colors",
                      isActive ? "bg-blue-600 text-white" : "hover:bg-slate-800"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                 )
              })}
              <Button 
                variant="destructive" 
                className="w-full mt-4 flex gap-2" 
                onClick={logout}
              >
                <LogOut className="h-4 w-4" /> Sair
              </Button>
            </nav>
          </div>
        )}

        {/* Conteúdo Principal */}
        <main className="flex-1 overflow-auto p-4 md:p-8 bg-gray-100">
          {children}
        </main>
      </div>

      {/* Conteúdo Principal Desktop */}
      <main className="hidden md:flex flex-1 flex-col overflow-auto p-8">
        {children}
      </main>

    </div>
  );
}