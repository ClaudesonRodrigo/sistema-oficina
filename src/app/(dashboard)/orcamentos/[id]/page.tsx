// src/app/(dashboard)/orcamentos/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation"; // useParams para pegar o ID da URL
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Printer } from "lucide-react";

// Interfaces
interface ItemOrcamento {
  id: string;
  nome: string;
  qtde: number;
  precoUnitario: number;
  tipo: "peca" | "servico";
}

interface Orcamento {
  id: string;
  numeroOrcamento: number;
  dataCriacao: Timestamp;
  nomeCliente: string;
  veiculoPlaca: string;
  veiculoModelo: string;
  servicosDescricao: string;
  status: string;
  valorTotal: number;
  itens: ItemOrcamento[];
  validadeDias: number; 
}

export default function OrcamentoDetailPage() {
  const router = useRouter();
  const params = useParams(); // Hook para ler o [id] da pasta
  const { id } = params; 

  const [orcamento, setOrcamento] = useState<Orcamento | null>(null);
  const [loading, setLoading] = useState(true);

  // Busca o orçamento no Firebase usando o ID da URL
  useEffect(() => {
    if (id) {
      const orcId = Array.isArray(id) ? id[0] : id; 
      const fetchOrcamento = async () => {
        setLoading(true);
        try {
          const docRef = doc(db, "orcamentos", orcId);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            setOrcamento({ id: docSnap.id, ...docSnap.data() } as Orcamento);
          } else {
            console.log("Orçamento não encontrado!");
            setOrcamento(null);
          }
        } catch (error) {
          console.error("Erro ao buscar orçamento:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchOrcamento();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        Carregando orçamento...
      </div>
    );
  }

  if (!orcamento) {
    return (
      <div className="text-center pt-10">
        <h1 className="text-2xl font-bold text-red-600">Orçamento Não Encontrado (404)</h1>
        <p className="text-gray-500 mb-4">Verifique se o ID está correto ou se foi excluído.</p>
        <Button onClick={() => router.back()} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="print-container p-4 md:p-8 max-w-4xl mx-auto">
      {/* --- Cabeçalho com botões (Não sai na impressão) --- */}
      <div className="flex justify-between items-center mb-6 no-print">
        <Button variant="outline" onClick={() => router.push("/orcamentos")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para lista
        </Button>

        <div className="flex gap-2">
           <Button onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Imprimir
          </Button>
        </div>
      </div>

      {/* --- Folha do Orçamento (Estilo A4 / Recibo) --- */}
      <Card id="os-receipt" className="border shadow-md print:shadow-none print:border-none">
        <CardContent className="p-8 print:p-0">
          
          {/* Cabeçalho do Documento */}
          <div className="text-center border-b pb-6 mb-6">
            <h2 className="text-3xl font-bold text-gray-900">Rodrigo Skaps</h2>
            <p className="text-sm text-gray-500 mt-1">Soluções em Escapamentos e Serviços Automotivos</p>
            <div className="mt-4 inline-block px-4 py-1 bg-gray-100 rounded-full border">
                <span className="text-lg font-semibold">ORÇAMENTO Nº {orcamento.numeroOrcamento}</span>
            </div>
            <p className="text-xs text-red-500 mt-2 font-medium">DOCUMENTO SEM VALOR FISCAL</p>
          </div>
          
          {/* Dados do Cliente e Veículo */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-8 text-sm">
            <div>
              <span className="block font-bold text-gray-500 text-xs uppercase">Cliente</span>
              <p className="text-lg font-medium">{orcamento.nomeCliente}</p>
            </div>
            <div>
              <span className="block font-bold text-gray-500 text-xs uppercase">Veículo</span>
              <p className="text-lg font-medium">{orcamento.veiculoModelo} <span className="text-gray-400">|</span> {orcamento.veiculoPlaca}</p>
            </div>
            <div>
              <span className="block font-bold text-gray-500 text-xs uppercase">Data de Emissão</span>
              <p>{new Date(orcamento.dataCriacao.seconds * 1000).toLocaleDateString()}</p>
            </div>
             <div>
              <span className="block font-bold text-gray-500 text-xs uppercase">Validade da Proposta</span>
              <p>{orcamento.validadeDias} dias</p>
            </div>
          </div>
          
          {/* Tabela de Itens */}
          <div className="mb-8">
            <h3 className="font-bold text-gray-900 mb-3 border-b pb-1">Peças e Serviços</h3>
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="w-[50%]">Descrição</TableHead>
                  <TableHead className="text-center">Qtd</TableHead>
                  <TableHead className="text-right">Vl. Unit.</TableHead>
                  <TableHead className="text-right font-bold text-black">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orcamento.itens.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-gray-700">{item.nome}</TableCell>
                    <TableCell className="text-center">{item.qtde}</TableCell>
                    <TableCell className="text-right">R$ {item.precoUnitario.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-bold">R$ {(item.qtde * item.precoUnitario).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Observações */}
          {orcamento.servicosDescricao && (
            <div className="mb-8 bg-gray-50 p-4 rounded-md border border-dashed">
              <h4 className="font-bold text-xs text-gray-500 uppercase mb-1">Observações Técnicas</h4>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{orcamento.servicosDescricao}</p>
            </div>
          )}

          {/* Totais */}
          <div className="flex justify-end border-t pt-4">
             <div className="text-right">
                <p className="text-sm text-gray-500">Valor Total do Orçamento</p>
                <h3 className="text-4xl font-bold text-gray-900">
                  R$ {orcamento.valorTotal.toFixed(2)}
                </h3>
             </div>
          </div>
          
          <div className="mt-12 text-center text-xs text-gray-400 border-t pt-4">
            <p>Obrigado pela preferência! Este orçamento está sujeito a análise presencial do veículo.</p>
          </div>
          
        </CardContent>
      </Card>
    </div>
  );
}