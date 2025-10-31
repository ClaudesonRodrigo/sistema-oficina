// src/app/(dashboard)/layout.tsx (O NOVO layout do painel)
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
      router.push("/login"); // (Vamos criar essa página em breve)
    }
  }, [user, loading, router]); // Roda sempre que o usuário ou o loading mudar

  // Se estiver carregando, mostra um "Carregando..."
  // (Podemos melhorar isso depois)
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        Carregando...
      </div>
    );
  }

  // Se houver usuário (e não estiver carregando), mostra o painel
  if (user) {
    return <MainLayout>{children}</MainLayout>;
  }

  // Se não houver usuário (e já tiver terminado de carregar),
  // o useEffect acima já terá redirecionado, então retornamos null
  return null;
}