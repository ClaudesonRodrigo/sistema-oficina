// src/app/(dashboard)/layout.tsx
"use client";

import MainLayout from "@/components/MainLayout";
import { useAuth } from "@/context/AuthContext"; // Nosso "Sensor"
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth(); // Pega o usuário e o estado de "carregando"
  const router = useRouter();

  useEffect(() => {
    // Se não estiver carregando e não houver usuário...
    if (!loading && !user) {
      // ...manda para a página de login!
      router.push("/login");
    }
  }, [user, loading, router]); // Roda sempre que o usuário ou o loading mudar

  // Se estiver carregando, mostra um "Carregando..."
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        Carregando...
      </div>
    );
  }

  // Se houver usuário (e não estiver carregando), mostra o painel
  if (user) {
    return <MainLayout>{children}</MainLayout>;
  }

  // Se não houver usuário (e já tiver terminado de carregar),
  // o useEffect acima já terá redirecionado, mas podemos retornar null
  return null;
}