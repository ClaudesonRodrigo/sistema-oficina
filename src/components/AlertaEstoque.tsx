"use client";

import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react"; // Ícone de alerta

// Interface para os produtos com estoque baixo
interface ProdutoBaixoEstoque {
  id: string;
  nome: string;
  estoqueAtual: number;
}

export default function AlertaEstoque() {
  const [produtos, setProdutos] = useState<ProdutoBaixoEstoque[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Criamos a query:
    const q = query(
      collection(db, "produtos"),
      where("tipo", "==", "peca"),        // Apenas peças
      where("estoqueAtual", "<=", 3)      // Onde o estoque é 3 ou menos
    );

    // 2. Usamos onSnapshot para ouvir em tempo real
    const unsub = onSnapshot(q, (snapshot) => {
      const lista: ProdutoBaixoEstoque[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        lista.push({
          id: doc.id,
          nome: data.nome,
          estoqueAtual: data.estoqueAtual,
        });
      });
      setProdutos(lista);
      setLoading(false);
    });

    // 3. Limpa o "ouvinte" quando o componente é desmontado
    return () => unsub();
  }, []);

  // 4. Se estiver carregando ou não houver produtos com estoque baixo, não mostra nada
  if (loading || produtos.length === 0) {
    return null;
  }

  // 5. Se houver produtos, mostra o Card de Alerta
  return (
    <Card className="mb-6 border-destructive bg-destructive/5 dark:bg-destructive/10">
      <CardHeader className="flex flex-row items-center space-x-3 space-y-0 pb-2">
        <AlertTriangle className="h-6 w-6 text-destructive" />
        <CardTitle className="text-destructive">
          Alerta de Estoque Baixo!
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4">Os seguintes itens precisam de reposição urgente:</p>
        <ul className="list-disc pl-5 space-y-1">
          {produtos.map((produto) => (
            <li key={produto.id}>
              <span className="font-bold">{produto.nome}</span> -
              {produto.estoqueAtual === 0 ? (
                <span className="font-bold text-destructive"> ESGOTADO</span>
              ) : (
                ` Restam apenas ${produto.estoqueAtual} unid.`
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}