// src/app/(dashboard)/page.tsx
"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

import AlertaEstoque from "@/components/AlertaEstoque";
// --- NOVO: Importa os Gráficos ---
import DashboardCharts from "@/components/DashboardCharts";

// Componentes Shadcn
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// --- Interfaces ---
interface ResultadoOS {
  id: string;
  numeroOS: number;
  dataFechamento?: Timestamp;
  dataAbertura: Timestamp;
  nomeCliente: string;
  veiculoPlaca: string;
  servicosDescricao?: string;
  status: string;
  valorTotal: number;
  garantiaDias?: number;
}
interface ResultadoProduto {
  id: string;
  nome: string;
  codigoSku: string;
  precoVenda: number;
  estoqueAtual: number;
  tipo: "peca" | "servico";
}
interface ResumoCaixa {
  faturamentoBruto: number;
  custoPecas: number;
  lucroBruto: number;
  saidas: number;
  lucroLiquido: number;
}

// --- Schemas de Validação ---
const placaSearchSchema = z.object({
  placa: z.string().min(3, { message: "Digite pelo menos 3 caracteres da placa." }),
});
const produtoSearchSchema = z.object({
  codigoSku: z.string().min(1, { message: "Digite o código do produto." }),
});

export default function HomePage() {
  const { userData } = useAuth();
  const isAdmin = userData?.role === 'admin';
  
  const [resumoCaixa, setResumoCaixa] = useState<ResumoCaixa>({
    faturamentoBruto: 0,
    custoPecas: 0,
    lucroBruto: 0,
    saidas: 0,
    lucroLiquido: 0,
  });
  const [loadingCaixa, setLoadingCaixa] = useState(true);

  // Estados da Busca por Placa
  const [resultadosPlaca, setResultadosPlaca] = useState<ResultadoOS[]>([]);
  const [loadingPlaca, setLoadingPlaca] = useState(false);
  const [searchedPlaca, setSearchedPlaca] = useState(false);

  // Estados para Busca de Produto
  const [produtoResultado, setProdutoResultado] = useState<ResultadoProduto | null>(null);
  const [loadingProduto, setLoadingProduto] = useState(false);
  const [searchedProduto, setSearchedProduto] = useState(false);

  // --- EFEITO PARA BUSCAR MOVIMENTAÇÕES ---
  useEffect(() => {
    if (isAdmin && userData) {
      setLoadingCaixa(true);
      const hoje = new Date();
      const inicioDoDia = new Date(hoje.setHours(0, 0, 0, 0));
      const fimDoDia = new Date(hoje.setHours(23, 59, 59, 999));

      const movRef = collection(db, "movimentacoes");
      
      const q = query(
        movRef,
        where("data", ">=", inicioDoDia),
        where("data", "<=", fimDoDia)
      );

      const unsub = onSnapshot(q, (snapshot) => {
        let faturamentoBruto = 0;
        let custoPecas = 0;
        let saidas = 0;

        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.tipo === "entrada") {
            faturamentoBruto += data.valor;
            custoPecas += data.custo || 0; 
          } else if (data.tipo === "saida") {
            saidas += data.valor;
          }
        });

        const lucroBruto = faturamentoBruto - custoPecas;
        const lucroLiquido = lucroBruto - saidas;

        setResumoCaixa({
          faturamentoBruto,
          custoPecas,
          lucroBruto,
          saidas,
          lucroLiquido,
        });
        setLoadingCaixa(false);
      });
      return () => unsub();
    } else {
      setLoadingCaixa(false); 
    }
  }, [isAdmin, userData]);

  // --- Configuração dos Formulários ---
  const formBuscaPlaca = useForm<z.infer<typeof placaSearchSchema>>({
    resolver: zodResolver(placaSearchSchema),
    defaultValues: { placa: "" },
    mode: "onSubmit", 
  });
  
  const formBuscaProduto = useForm<z.infer<typeof produtoSearchSchema>>({
    resolver: zodResolver(produtoSearchSchema),
    defaultValues: { codigoSku: "" },
    mode: "onSubmit", 
  });

  // --- Função de Busca por Placa ---
  async function onPlacaSubmit(values: z.infer<typeof placaSearchSchema>) {
    setLoadingPlaca(true);
    setSearchedPlaca(true);
    setResultadosPlaca([]);
    try {
      const osRef = collection(db, "ordensDeServico");
      const q = query(
        osRef,
        where("veiculoPlaca", "==", values.placa.toUpperCase()),
        orderBy("dataAbertura", "desc")
      );
      const querySnapshot = await getDocs(q);
      const listaResultados: ResultadoOS[] = [];
      querySnapshot.forEach((doc) => {
        listaResultados.push({ id: doc.id, ...doc.data() } as ResultadoOS);
      });
      setResultadosPlaca(listaResultados);
    } catch (error) {
      console.error("Erro ao buscar OS por placa: ", error);
    } finally {
      setLoadingPlaca(false);
    }
  }

  // --- Função de Busca por Produto (SKU) ---
  async function onProdutoSubmit(values: z.infer<typeof produtoSearchSchema>) {
    setLoadingProduto(true);
    setSearchedProduto(true);
    setProdutoResultado(null);
    try {
      const prodRef = collection(db, "produtos");
      const q = query(
        prodRef,
        where("codigoSku", "==", values.codigoSku.toUpperCase())
      );
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        setProdutoResultado(null);
      } else {
        const doc = querySnapshot.docs[0];
        setProdutoResultado({ id: doc.id, ...doc.data() } as ResultadoProduto);
      }
    } catch (error) {
      console.error("Erro ao buscar produto por SKU: ", error);
    } finally {
      setLoadingProduto(false);
    }
  }

  // --- Função de Garantia ---
  const getGarantiaStatus = (os: ResultadoOS) => {
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

  return (
    <div>
      {/* --- Alerta de Estoque (SÓ ADMIN) --- */}
      {isAdmin && <AlertaEstoque />}

      {/* --- RESUMO DO CAIXA (SÓ ADMIN) --- */}
      {isAdmin && (
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-6">Resumo do Dia</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Faturamento Bruto</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingCaixa ? (<p>Carregando...</p>) : (
                  <div className="text-2xl font-bold text-blue-600">
                    R$ {resumoCaixa.faturamentoBruto.toFixed(2)}
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Custo Peças</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingCaixa ? (<p>Carregando...</p>) : (
                  <div className="text-2xl font-bold text-gray-500">
                    R$ {resumoCaixa.custoPecas.toFixed(2)}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Lucro Bruto</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingCaixa ? (<p>Carregando...</p>) : (
                  <div className="text-2xl font-bold text-green-600">
                    R$ {resumoCaixa.lucroBruto.toFixed(2)}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Despesas</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingCaixa ? (<p>Carregando...</p>) : (
                  <div className="text-2xl font-bold text-red-600">
                    R$ {resumoCaixa.saidas.toFixed(2)}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Lucro Líquido</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingCaixa ? (<p>Carregando...</p>) : (
                  <div className="text-2xl font-bold">
                    R$ {resumoCaixa.lucroLiquido.toFixed(2)}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* --- NOVO: GRÁFICOS DO DASHBOARD --- */}
          <DashboardCharts />
        </div>
      )}

      {/* --- CONSULTA DE PRODUTOS (SÓ ADMIN) --- */}
      {isAdmin && (
        <div className="mt-8 border-t pt-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-6">Consulta Rápida de Produto</h1>
          <Form {...formBuscaProduto}>
            <form id="form-produto" onSubmit={formBuscaProduto.handleSubmit(onProdutoSubmit)} className="flex flex-col md:flex-row gap-4 mb-8">
              <FormField
                control={formBuscaProduto.control}
                name="codigoSku"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Input
                        placeholder="Digite o Código (SKU) do produto"
                        {...field}
                        className="text-base md:text-lg p-4 md:p-6"
                        autoComplete="off"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" form="form-produto" disabled={loadingProduto} className="p-4 md:p-6 text-base md:text-lg">
                {loadingProduto ? "Buscando..." : "Buscar Produto"}
              </Button>
            </form>
          </Form>

          {loadingProduto && <p>Buscando produto...</p>}
          {!loadingProduto && searchedProduto && !produtoResultado && (
            <Card className="mt-4">
              <CardContent className="pt-6">
                <p className="text-center text-lg">Nenhum produto encontrado com este SKU.</p>
              </CardContent>
            </Card>
          )}
          {!loadingProduto && produtoResultado && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>{produtoResultado.nome} ({produtoResultado.codigoSku})</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="font-medium">Estoque Atual:</p>
                  <p className="text-2xl font-bold">
                    {produtoResultado.tipo === 'peca' ? produtoResultado.estoqueAtual : 'N/A (Serviço)'}
                  </p>
                </div>
                 <div>
                  <p className="font-medium">Preço de Venda:</p>
                  <p className="text-2xl font-bold">
                    R$ {produtoResultado.precoVenda.toFixed(2)}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* --- CONSULTA DE GARANTIA (PARA TODOS) --- */}
      <div className="mt-8 md:mt-12 border-t pt-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-6">Consulta Rápida de Garantia</h1>
        <p className="text-base md:text-lg mb-4">
          Digite a placa do veículo para ver o histórico completo.
        </p>

        <Form {...formBuscaPlaca}>
          <form id="form-placa" onSubmit={formBuscaPlaca.handleSubmit(onPlacaSubmit)} className="flex flex-col md:flex-row gap-4 mb-8">
            <FormField
              control={formBuscaPlaca.control}
              name="placa"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input
                      placeholder="Digite a placa (ex: ABC-1234)"
                      {...field}
                      className="text-base md:text-lg p-4 md:p-6"
                      autoComplete="off"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" form="form-placa" disabled={loadingPlaca} className="p-4 md:p-6 text-base md:text-lg">
              {loadingPlaca ? "Buscando..." : "Buscar Placa"}
            </Button>
          </form>
        </Form>

        {loadingPlaca && <p>Buscando histórico...</p>}

        {!loadingPlaca && searchedPlaca && resultadosPlaca.length === 0 && (
          <Card className="mt-4">
            <CardContent className="pt-6">
              <p className="text-center text-lg">
                Nenhuma Ordem de Serviço encontrada para esta placa.
              </p>
            </CardContent>
          </Card>
        )}

        {!loadingPlaca && resultadosPlaca.length > 0 && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>
                Histórico da Placa: {resultadosPlaca[0].veiculoPlaca}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº OS</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status Garantia</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Valor Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultadosPlaca.map((os) => (
                    <TableRow key={os.id}>
                      <TableCell>
                        <Link
                          href={`/os/${os.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {os.numeroOS}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {os.dataFechamento
                          ? new Date(
                              os.dataFechamento.seconds * 1000
                            ).toLocaleDateString()
                          : new Date(
                              os.dataAbertura.seconds * 1000
                            ).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{getGarantiaStatus(os)}</TableCell>
                      <TableCell>{os.nomeCliente}</TableCell>
                      <TableCell>R$ {os.valorTotal.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}