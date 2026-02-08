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
  onSnapshot,
} from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
// Importando date-fns para garantir datas corretas
import { startOfDay, endOfDay } from "date-fns";
import { toast } from "sonner"; // Feedback visual
import { Loader2, Search, Package, Wrench, DollarSign, TrendingDown, TrendingUp } from "lucide-react";

import AlertaEstoque from "@/components/AlertaEstoque";
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

// Importando Tipos Globais (Regra Suprema)
import { OrdemDeServico, Produto } from "@/types";

// Interface Local para Resumo (já que é específica dessa tela)
interface ResumoCaixa {
  faturamentoBruto: number;
  custoPecas: number;
  lucroBruto: number;
  saidas: number;
  lucroLiquido: number;
}

// --- Schemas de Validação ---
const placaSearchSchema = z.object({
  placa: z.string().min(3, { message: "Digite pelo menos 3 caracteres." }),
});
const produtoSearchSchema = z.object({
  codigoSku: z.string().min(1, { message: "Digite o código do produto." }),
});

export default function HomePage() {
  const { userData, loading: authLoading } = useAuth();
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
  const [resultadosPlaca, setResultadosPlaca] = useState<OrdemDeServico[]>([]);
  const [loadingPlaca, setLoadingPlaca] = useState(false);
  const [searchedPlaca, setSearchedPlaca] = useState(false);

  // Estados para Busca de Produto
  const [produtoResultado, setProdutoResultado] = useState<Produto | null>(null);
  const [loadingProduto, setLoadingProduto] = useState(false);
  const [searchedProduto, setSearchedProduto] = useState(false);

  // --- EFEITO PARA BUSCAR MOVIMENTAÇÕES (CAIXA) ---
  useEffect(() => {
    if (isAdmin && userData) {
      setLoadingCaixa(true);
      
      const hoje = new Date();
      const inicioDoDia = startOfDay(hoje);
      const fimDoDia = endOfDay(hoje);

      const movRef = collection(db, "movimentacoes");
      
      const q = query(
        movRef,
        where("data", ">=", inicioDoDia),
        where("data", "<=", fimDoDia)
      );

      console.log("Iniciando monitoramento do caixa...");

      const unsub = onSnapshot(q, (snapshot) => {
        let faturamentoBruto = 0;
        let custoPecas = 0;
        let saidas = 0;

        snapshot.forEach((doc) => {
          const data = doc.data();
          const valor = Number(data.valor) || 0;
          const custo = Number(data.custo) || 0;

          if (data.tipo === "entrada") {
            faturamentoBruto += valor;
            custoPecas += custo; 
          } else if (data.tipo === "saida") {
            saidas += valor;
          }
        });

        setResumoCaixa({
          faturamentoBruto,
          custoPecas,
          lucroBruto: faturamentoBruto - custoPecas,
          saidas,
          lucroLiquido: (faturamentoBruto - custoPecas) - saidas,
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
  });
  
  const formBuscaProduto = useForm<z.infer<typeof produtoSearchSchema>>({
    resolver: zodResolver(produtoSearchSchema),
    defaultValues: { codigoSku: "" },
  });

  // --- BUSCA INTELIGENTE DE PLACA (DINÂMICA) ---
  async function onPlacaSubmit(values: z.infer<typeof placaSearchSchema>) {
    setLoadingPlaca(true);
    setSearchedPlaca(true);
    setResultadosPlaca([]);
    
    try {
      const osRef = collection(db, "ordensDeServico");
      
      // 1. Tratamento da Placa (Gera variações para garantir que encontra)
      const inputRaw = values.placa.toUpperCase().trim();
      const placaLimpa = inputRaw.replace(/[^A-Z0-9]/g, ""); // Ex: ABC1234
      
      // Tenta criar formato com traço se tiver 7 chars (padrão antigo/mercosul)
      let placaComTraco = inputRaw;
      if (placaLimpa.length === 7) {
         placaComTraco = `${placaLimpa.substring(0,3)}-${placaLimpa.substring(3)}`; // Ex: ABC-1234
      }

      // 2. Busca usando 'in' para pegar qualquer um dos formatos
      // Obs: 'in' aceita até 10 valores. Passamos as variações possíveis.
      const q = query(
        osRef,
        where("veiculoPlaca", "in", [placaLimpa, placaComTraco, inputRaw])
      );
      
      const querySnapshot = await getDocs(q);
      const listaResultados: OrdemDeServico[] = [];
      
      querySnapshot.forEach((doc) => {
        listaResultados.push({ id: doc.id, ...doc.data() } as OrdemDeServico);
      });

      // 3. Ordenação em Memória (Evita erro de índice no Firestore ao usar 'in')
      listaResultados.sort((a, b) => {
        // @ts-ignore - Garantindo acesso ao timestamp
        const dateA = a.dataAbertura?.seconds || 0;
        // @ts-ignore
        const dateB = b.dataAbertura?.seconds || 0;
        return dateB - dateA; // Mais recentes primeiro
      });

      if (listaResultados.length === 0) {
        toast.info("Nenhum histórico encontrado para esta placa.");
      } else {
        toast.success(`${listaResultados.length} serviços encontrados.`);
      }

      setResultadosPlaca(listaResultados);
    } catch (error) {
      console.error("Erro ao buscar OS por placa: ", error);
      toast.error("Erro ao buscar histórico.");
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
      // Busca exata pelo SKU (Geralmente SKU é único e preciso)
      const q = query(
        prodRef,
        where("codigoSku", "==", values.codigoSku.toUpperCase().trim())
      );
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        toast.info("Produto não encontrado.");
        setProdutoResultado(null);
      } else {
        const doc = querySnapshot.docs[0];
        setProdutoResultado({ id: doc.id, ...doc.data() } as Produto);
        toast.success("Produto localizado!");
      }
    } catch (error) {
      console.error("Erro ao buscar produto: ", error);
      toast.error("Erro na busca do produto.");
    } finally {
      setLoadingProduto(false);
    }
  }

  // --- Função de Garantia ---
  const getGarantiaStatus = (os: OrdemDeServico) => {
    if (os.status !== 'finalizada' || !os.dataFechamento) {
      return <span className="text-gray-500 font-medium capitalize">{os.status}</span>;
    }
    if (!os.garantiaDias || os.garantiaDias === 0) {
      return <span className="text-gray-500 font-medium">Sem Garantia</span>;
    }
    
    // @ts-ignore - Tratamento seguro do timestamp
    const dataFechamento = new Date(os.dataFechamento.seconds * 1000);
    const dataExpiracao = new Date(dataFechamento);
    dataExpiracao.setDate(dataExpiracao.getDate() + os.garantiaDias);
    
    const hoje = new Date();
    
    if (hoje > dataExpiracao) {
      return <span className="font-bold text-red-600 bg-red-100 px-2 py-1 rounded">Expirada</span>;
    } else {
      const diasRestantes = Math.ceil((dataExpiracao.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      return <span className="font-bold text-green-600 bg-green-100 px-2 py-1 rounded">Vigente ({diasRestantes} dias)</span>;
    }
  };

  if (authLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>;
  }

  return (
    <div>
      {/* --- Alerta de Estoque (SÓ ADMIN) --- */}
      {isAdmin && <AlertaEstoque />}

      {/* --- RESUMO DO CAIXA (SÓ ADMIN) --- */}
      {isAdmin && (
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-6">Resumo do Dia</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {/* Cards de Resumo Financeiro */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Faturamento</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loadingCaixa ? <p className="text-xs">Carregando...</p> : (
                  <div className="text-2xl font-bold text-blue-600">
                    R$ {resumoCaixa.faturamentoBruto.toFixed(2)}
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Custo Peças</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loadingCaixa ? <p className="text-xs">Carregando...</p> : (
                  <div className="text-2xl font-bold text-gray-500">
                    R$ {resumoCaixa.custoPecas.toFixed(2)}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Lucro Bruto</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                {loadingCaixa ? <p className="text-xs">Carregando...</p> : (
                  <div className="text-2xl font-bold text-green-600">
                    R$ {resumoCaixa.lucroBruto.toFixed(2)}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Despesas</CardTitle>
                <TrendingDown className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                {loadingCaixa ? <p className="text-xs">Carregando...</p> : (
                  <div className="text-2xl font-bold text-red-600">
                    R$ {resumoCaixa.saidas.toFixed(2)}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-slate-50 border-slate-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-bold">Líquido Final</CardTitle>
                <DollarSign className="h-4 w-4 text-slate-900" />
              </CardHeader>
              <CardContent>
                {loadingCaixa ? <p className="text-xs">Carregando...</p> : (
                  <div className={`text-2xl font-bold ${resumoCaixa.lucroLiquido >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
                    R$ {resumoCaixa.lucroLiquido.toFixed(2)}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="mt-6">
             <DashboardCharts />
          </div>
        </div>
      )}

      {/* --- CONSULTA DE PRODUTOS (SÓ ADMIN) --- */}
      {isAdmin && (
        <div className="mt-8 border-t pt-8">
          <h1 className="text-2xl md:text-3xl font-bold mb-4 flex items-center gap-2">
            <Package className="h-8 w-8" /> Consulta Rápida de Produto
          </h1>
          <Form {...formBuscaProduto}>
            <form onSubmit={formBuscaProduto.handleSubmit(onProdutoSubmit)} className="flex flex-col md:flex-row gap-4 mb-6">
              <FormField
                control={formBuscaProduto.control}
                name="codigoSku"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <div className="relative">
                        <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                        <Input
                          placeholder="Bipe ou digite o código SKU..."
                          {...field}
                          className="pl-10 text-lg h-12"
                          autoComplete="off"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={loadingProduto} className="h-12 px-8 text-lg">
                {loadingProduto ? <Loader2 className="animate-spin" /> : "Buscar"}
              </Button>
            </form>
          </Form>

          {!loadingProduto && searchedProduto && !produtoResultado && (
            <p className="text-muted-foreground text-center py-4">Nenhum produto encontrado com este SKU.</p>
          )}
          
          {!loadingProduto && produtoResultado && (
            <Card className="border-l-4 border-l-blue-500 bg-blue-50/50">
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span>{produtoResultado.nome}</span>
                  <span className="text-sm font-normal text-muted-foreground">SKU: {produtoResultado.codigoSku}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <p className="text-sm text-muted-foreground uppercase font-bold">Estoque Atual</p>
                  <p className="text-4xl font-bold text-slate-800">
                    {produtoResultado.tipo === 'peca' ? produtoResultado.estoqueAtual : '∞'}
                  </p>
                </div>
                 <div>
                  <p className="text-sm text-muted-foreground uppercase font-bold">Preço de Venda</p>
                  <p className="text-4xl font-bold text-green-600">
                    R$ {produtoResultado.precoVenda.toFixed(2)}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* --- CONSULTA DE GARANTIA (PARA TODOS) --- */}
      <div className="mt-12 border-t pt-8 pb-20">
        <h1 className="text-2xl md:text-3xl font-bold mb-4 flex items-center gap-2">
          <Wrench className="h-8 w-8" /> Consulta de Garantia / Histórico
        </h1>
        <p className="text-muted-foreground mb-4">
          Digite a placa do veículo para ver todas as manutenções e status da garantia.
        </p>

        <Form {...formBuscaPlaca}>
          <form onSubmit={formBuscaPlaca.handleSubmit(onPlacaSubmit)} className="flex flex-col md:flex-row gap-4 mb-8">
            <FormField
              control={formBuscaPlaca.control}
              name="placa"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                      <Input
                        placeholder="Digite a placa (ex: ABC-1234 ou ABC1234)"
                        {...field}
                        className="pl-10 text-lg h-12 uppercase"
                        autoComplete="off"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={loadingPlaca} className="h-12 px-8 text-lg">
              {loadingPlaca ? <Loader2 className="animate-spin" /> : "Consultar Placa"}
            </Button>
          </form>
        </Form>

        {!loadingPlaca && searchedPlaca && resultadosPlaca.length === 0 && (
          <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed">
            <p className="text-lg text-gray-500">Nenhum serviço encontrado para esta placa.</p>
          </div>
        )}

        {!loadingPlaca && resultadosPlaca.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>
                Histórico do Veículo: {resultadosPlaca[0].veiculoPlaca}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº OS</TableHead>
                    <TableHead>Data Serviço</TableHead>
                    <TableHead>Status Garantia</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultadosPlaca.map((os) => (
                    <TableRow key={os.id}>
                      <TableCell>
                        <Link
                          href={`/os/${os.id}`}
                          className="font-bold text-blue-600 hover:underline"
                        >
                          #{os.numeroOS}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {/* @ts-ignore */}
                        {os.dataFechamento
                          // @ts-ignore
                          ? new Date(os.dataFechamento.seconds * 1000).toLocaleDateString()
                          // @ts-ignore
                          : new Date(os.dataAbertura.seconds * 1000).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{getGarantiaStatus(os)}</TableCell>
                      <TableCell>{os.nomeCliente}</TableCell>
                      <TableCell className="font-mono">R$ {os.valorTotal.toFixed(2)}</TableCell>
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