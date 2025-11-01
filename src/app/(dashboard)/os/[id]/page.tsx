// src/app/(dashboard)/os/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Printer } from "lucide-react";

// --- Interface para os dados da OS (COM NOVOS CAMPOS) ---
interface ItemOS {
  id: string;
  nome: string;
  qtde: number;
  precoUnitario: number;
  tipo: "peca" | "servico";
}
interface OrdemDeServico {
  id: string;
  numeroOS: number;
  dataAbertura: Timestamp;
  dataFechamento?: Timestamp; // <-- NOVO CAMPO
  nomeCliente: string;
  veiculoPlaca: string;
  veiculoModelo: string;
  servicosDescricao: string;
  status: string;
  valorTotal: number;
  itens: ItemOS[];
  garantiaDias?: number; // <-- NOVO CAMPO
}

export default function OsDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { id } = params; 

  const [os, setOs] = useState<OrdemDeServico | null>(null);
  const [loading, setLoading] = useState(true);

  // --- Efeito para buscar a OS específica ---
  useEffect(() => {
    if (id) {
      const osId = Array.isArray(id) ? id[0] : id; 
      const fetchOS = async () => {
        setLoading(true);
        try {
          const docRef = doc(db, "ordensDeServico", osId);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            setOs({ id: docSnap.id, ...docSnap.data() } as OrdemDeServico);
          } else {
            console.log("Nenhuma OS encontrada com este ID!");
            setOs(null);
          }
        } catch (error) {
          console.error("Erro ao buscar OS:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchOS();
    }
  }, [id]);

  // --- NOVA FUNÇÃO: CALCULAR STATUS DA GARANTIA ---
  const getGarantiaStatus = (os: OrdemDeServico) => {
    if (os.status !== 'finalizada' || !os.dataFechamento) {
      return <span className="text-gray-500 capitalize">{os.status}</span>;
    }
    if (!os.garantiaDias || os.garantiaDias === 0) {
      return <span className="text-gray-500">Sem Garantia</span>;
    }
    const dataFechamento = new Date(os.dataFechamento.seconds * 1000);
    const dataExpiracao = new Date(dataFechamento);
    dataExpiracao.setDate(dataExpiracao.getDate() + os.garantiaDias);
    const hoje = new Date();

    if (hoje > dataExpiracao) {
      return <span className="font-bold text-red-600">Fora da Garantia</span>;
    } else {
      return <span className="font-bold text-green-600">Na Garantia</span>;
    }
  };


  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        Carregando dados da OS...
      </div>
    );
  }

  if (!os) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold">Ordem de Serviço Não Encontrada</h1>
        <Button onClick={() => router.back()} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="print-container">/page.tsx"]
      {/* --- Cabeçalho com botões --- */}
      <div className="flex justify-between items-center mb-6 no-print">/page.tsx"]
        <Button variant="outline" onClick={() => router.push("/os")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para lista
        </Button>

        <h1 className="text-2xl font-bold">Detalhes da OS: {os.numeroOS}</h1>

        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" /> Imprimir Comprovante
        </Button>
      </div>

      {/* --- Conteúdo da OS --- */}
      <Card id="os-receipt">/page.tsx"]
        <CardContent className="p-6">
          {/* Dados do Cliente e Veículo */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div>
              <p className="font-semibold">Cliente:</p>
              <p>{os.nomeCliente}</p>
            </div>
            <div>
              <p className="font-semibold">Placa:</p>
              <p>{os.veiculoPlaca}</p>
            </div>
            <div>
              <p className="font-semibold">Modelo:</p>
              <p>{os.veiculoModelo}</p>
            </div>
            <div>
              <p className="font-semibold">Data Abertura:</p>
              <p>{new Date(os.dataAbertura.seconds * 1000).toLocaleString()}</p>
            </div>
             <div>
              <p className="font-semibold">Data Fechamento:</p>
              <p>{os.dataFechamento ? new Date(os.dataFechamento.seconds * 1000).toLocaleString() : "N/A"}</p>
            </div>
            <div>
              <p className="font-semibold">Garantia:</p>
              <p>{getGarantiaStatus(os)}</p>
            </div>
          </div>
          
          {/* Descrição dos Serviços */}
          {os.servicosDescricao && (
            <div className="mb-6">
              <p className="font-semibold">Descrição/Observações:</p>
              <p className="whitespace-pre-wrap">{os.servicosDescricao}</p>
            </div>
          )}

          {/* Itens da OS */}
          <p className="font-semibold mb-2">Itens e Peças:</p>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Qtde</TableHead>
                  <TableHead>Vl. Unit.</TableHead>
                  <TableHead>Vl. Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {os.itens.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.nome}</TableCell>
                    <TableCell>{item.qtde}</TableCell>
                    <TableCell>R$ {item.precoUnitario.toFixed(2)}</TableCell>
                    <TableCell>R$ {(item.qtde * item.precoUnitario).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Total */}
          <div className="flex justify-end mt-6">
            <h2 className="text-2xl font-bold">
              Total da OS: R$ {os.valorTotal.toFixed(2)}
            </h2>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}