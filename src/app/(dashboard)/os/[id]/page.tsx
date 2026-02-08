// src/app/(dashboard)/os/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { OrdemDeServico } from "@/types"; // Usando os tipos globais
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Printer, ArrowLeft, CheckCircle, Ban, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image"; // <--- IMPORTANTE PARA A LOGO

export default function DetalhesOSPage() {
  const { id } = useParams();
  const router = useRouter();
  const { userData, loading: authLoading } = useAuth();
  
  const [os, setOs] = useState<OrdemDeServico | null>(null);
  const [loading, setLoading] = useState(true);

  // --- BUSCAR DADOS DA OS ---
  useEffect(() => {
    async function fetchOS() {
      if (!id) return;
      try {
        const docRef = doc(db, "ordensDeServico", id as string);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setOs({ id: docSnap.id, ...docSnap.data() } as OrdemDeServico);
        } else {
          toast.error("OS não encontrada.");
          router.push("/os");
        }
      } catch (error) {
        console.error("Erro ao buscar OS:", error);
        toast.error("Erro ao carregar dados.");
      } finally {
        setLoading(false);
      }
    }

    if (userData) {
      fetchOS();
    }
  }, [id, userData, router]);

  // --- FUNÇÕES DE AÇÃO ---
  const handlePrint = () => {
    window.print();
  };

  const alterarStatus = async (novoStatus: "finalizada" | "cancelada" | "aberta") => {
    if (!os) return;
    if (!confirm(`Deseja alterar o status para ${novoStatus.toUpperCase()}?`)) return;

    try {
      const docRef = doc(db, "ordensDeServico", os.id);
      await updateDoc(docRef, { 
        status: novoStatus,
        dataFechamento: novoStatus === 'finalizada' ? new Date() : null
      });
      
      setOs({ ...os, status: novoStatus });
      toast.success(`Status alterado para ${novoStatus}!`);
    } catch (error) {
      toast.error("Erro ao atualizar status.");
    }
  };

  if (authLoading || loading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>;
  }

  if (!os) return null;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 print:p-0 print:max-w-none">
      
      {/* --- BARRA DE AÇÕES (Somente Tela) --- */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 print:hidden">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
        
        <div className="flex gap-2">
          {os.status === 'aberta' && (
            <>
              <Button variant="destructive" onClick={() => alterarStatus('cancelada')}>
                <Ban className="mr-2 h-4 w-4" /> Cancelar
              </Button>
              <Button className="bg-green-600 hover:bg-green-700" onClick={() => alterarStatus('finalizada')}>
                <CheckCircle className="mr-2 h-4 w-4" /> Finalizar
              </Button>
            </>
          )}
          <Button onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" /> Imprimir
          </Button>
        </div>
      </div>

      {/* --- ÁREA DE IMPRESSÃO (Folha A4) --- */}
      <Card className="print:shadow-none print:border-none">
        <CardHeader className="border-b pb-6">
          <div className="flex justify-between items-start">
            
            {/* --- LOGO E DADOS DA OFICINA --- */}
            <div className="flex gap-4 items-center">
              <div className="relative w-24 h-24 print:w-32 print:h-32">
                {/* AQUI ESTÁ A MÁGICA DA LOGO */}
                <Image 
                  src="/logo.png" 
                  alt="Logo Oficina" 
                  fill 
                  className="object-contain"
                  priority
                />
              </div>
              <div>
                <h1 className="text-2xl font-bold uppercase">Rodrigo Skap</h1>
                <p className="text-sm text-gray-500">Oficina Especializada em Escapamentos</p>
                <p className="text-sm text-gray-500">Tel: (79) 99633-7995</p>
                <p className="text-sm text-gray-500">Aracaju - SE</p>
              </div>
            </div>

            {/* DADOS DA OS */}
            <div className="text-right">
              <h2 className="text-3xl font-bold text-gray-800">OS #{os.numeroOS}</h2>
              <p className="text-sm text-gray-500 mt-1">
                Data: {os.dataAbertura ? new Date((os.dataAbertura as any).seconds * 1000).toLocaleDateString() : '-'}
              </p>
              <div className={`mt-2 inline-block px-3 py-1 rounded-full text-sm font-bold border uppercase
                ${os.status === 'aberta' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : ''}
                ${os.status === 'finalizada' ? 'bg-green-100 text-green-700 border-green-200' : ''}
                ${os.status === 'cancelada' ? 'bg-red-100 text-red-700 border-red-200' : ''}
              `}>
                {os.status}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-8">
          
          {/* INFORMAÇÕES CLIENTE E VEÍCULO */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2">
            <div className="p-4 bg-gray-50 rounded-lg border print:border-gray-300">
              <h3 className="font-bold text-gray-700 mb-2 border-b pb-1">Cliente</h3>
              <p><span className="font-medium">Nome:</span> {os.nomeCliente}</p>
              {/* Você pode adicionar telefone/cpf aqui se tiver salvo na OS */}
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border print:border-gray-300">
              <h3 className="font-bold text-gray-700 mb-2 border-b pb-1">Veículo</h3>
              <p><span className="font-medium">Modelo:</span> {os.veiculoModelo || 'Não informado'}</p>
              <p><span className="font-medium">Placa:</span> <span className="uppercase font-mono bg-white px-1 rounded border">{os.veiculoPlaca}</span></p>
            </div>
          </div>

          {/* DESCRIÇÃO DOS SERVIÇOS */}
          {os.servicosDescricao && (
            <div>
              <h3 className="font-bold text-gray-700 mb-2">Relato / Serviços a Executar:</h3>
              <div className="p-4 bg-gray-50 rounded-lg border min-h-20 print:border-gray-300 whitespace-pre-wrap">
                {os.servicosDescricao}
              </div>
            </div>
          )}

          {/* TABELA DE PEÇAS E SERVIÇOS */}
          <div>
            <h3 className="font-bold text-gray-700 mb-2">Peças e Serviços Utilizados</h3>
            <div className="border rounded-lg overflow-hidden print:border-gray-300">
              <Table>
                <TableHeader className="bg-gray-100 print:bg-gray-200">
                  <TableRow>
                    <TableHead className="text-gray-700 font-bold">Item / Descrição</TableHead>
                    <TableHead className="text-center text-gray-700 font-bold w-[100px]">Qtd</TableHead>
                    <TableHead className="text-right text-gray-700 font-bold w-[120px]">Vl. Unit.</TableHead>
                    <TableHead className="text-right text-gray-700 font-bold w-[120px]">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {os.itens.map((item, index) => (
                    <TableRow key={index} className="print:border-b-gray-300">
                      <TableCell>
                        <span className="font-medium">{item.nome}</span>
                        <span className="ml-2 text-xs text-gray-500 uppercase border px-1 rounded">
                          {item.tipo}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">{item.qtde}</TableCell>
                      <TableCell className="text-right">R$ {item.precoUnitario.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium">
                        R$ {(item.precoUnitario * item.qtde).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {os.itens.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 text-gray-500">
                        Nenhum item adicionado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* TOTAIS E GARANTIA */}
          <div className="flex flex-col md:flex-row justify-between items-start gap-6 print:flex-row print:justify-between">
            <div className="w-full md:w-1/2 print:w-1/2">
              <h3 className="font-bold text-gray-700 mb-2">Termos e Garantia</h3>
              <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded border print:border-gray-300">
                <p>Garantia de <strong>{os.garantiaDias} dias</strong> sobre os serviços executados.</p>
                <p className="mt-1 text-xs">A garantia não cobre mau uso ou peças fornecidas pelo cliente.</p>
              </div>
            </div>

            <div className="w-full md:w-1/3 print:w-1/3">
              <div className="bg-gray-100 p-4 rounded-lg border print:bg-transparent print:border-gray-300">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Total Peças/Serviços:</span>
                  <span className="font-medium">R$ {os.valorTotal.toFixed(2)}</span>
                </div>
                {/* Se quiser adicionar Desconto aqui futuramente, pode */}
                <div className="flex justify-between items-center border-t border-gray-300 pt-2 mt-2">
                  <span className="text-lg font-bold text-gray-800">Total Geral:</span>
                  <span className="text-2xl font-bold text-gray-900">R$ {os.valorTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* RODAPÉ IMPRESSÃO */}
          <div className="hidden print:block mt-12 pt-8 border-t text-center text-xs text-gray-400">
            <p>Rodrigo Skap - Sistema de Gestão de Oficina</p>
            <p>Emitido em {new Date().toLocaleString()}</p>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}