// src/app/(dashboard)/relatorios/page.tsx
"use client";

import { useState, useEffect } from "react"; // 1. useEffect será usado
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";

// --- 2. NOVAS IMPORTAÇÕES PARA AUTENTICAÇÃO E ROTEAMENTO ---
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

// Componentes Shadcn
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// --- Interface para Movimentações ---
interface Movimentacao {
  id: string;
  data: Timestamp;
  tipo: "entrada" | "saida";
  descricao: string;
  valor: number;
  custo?: number;
  formaPagamento: string;
}

// --- Interface para Resumo ---
interface ResumoCaixa {
  faturamentoBruto: number;
  custoPecas: number;
  lucroBruto: number;
  saidas: number;
  lucroLiquido: number;
}

// --- Schema de Validação ZOD ---
const reportSchema = z.object({
  dataInicio: z.date(),
  dataFim: z.date(),
});

export default function RelatoriosPage() {
  const [resumo, setResumo] = useState<ResumoCaixa | null>(null);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  // Este 'loading' é para o formulário de busca
  const [loading, setLoading] = useState(false);

  // --- 3. ADICIONA A PROTEÇÃO DE ROTA (O "GUARDIÃO") ---
  const { userData, loading: authLoading } = useAuth(); // Renomeia o loading do Auth
  const router = useRouter();

  // Verifica as permissões ANTES de tentar buscar dados
  useEffect(() => {
    if (!authLoading && userData && userData.role !== 'admin') {
      // Se não estiver carregando, tiver dados E o usuário NÃO for admin
      router.push('/'); // Manda ele de volta pro Dashboard
    }
  }, [userData, authLoading, router]);
  // --- FIM DA PROTEÇÃO ---

  // --- Configuração do Formulário de Data ---
  const form = useForm<z.infer<typeof reportSchema>>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      dataInicio: startOfDay(new Date()), // Hoje
      dataFim: endOfDay(new Date()), // Hoje
    },
  });

  // --- Função de Busca por Período ---
  async function onSubmit(values: z.infer<typeof reportSchema>) {
    setLoading(true);
    setResumo(null);
    setMovimentacoes([]);

    const dataInicio = startOfDay(values.dataInicio);
    const dataFim = endOfDay(values.dataFim);

    try {
      const movRef = collection(db, "movimentacoes");
      const q = query(
        movRef,
        where("data", ">=", dataInicio),
        where("data", "<=", dataFim)
      );

      const querySnapshot = await getDocs(q);

      let faturamentoBruto = 0;
      let custoPecas = 0;
      let saidas = 0;
      const listaMovimentacoes: Movimentacao[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data() as Omit<Movimentacao, 'id'>;
        listaMovimentacoes.push({ id: doc.id, ...data });

        if (data.tipo === "entrada") {
          faturamentoBruto += data.valor;
          custoPecas += data.custo || 0;
        } else if (data.tipo === "saida") {
          saidas += data.valor;
        }
      });

      const lucroBruto = faturamentoBruto - custoPecas;
      const lucroLiquido = lucroBruto - saidas;

      setResumo({
        faturamentoBruto,
        custoPecas,
        lucroBruto,
        saidas,
        lucroLiquido,
      });
      setMovimentacoes(listaMovimentacoes);
    } catch (error) {
      // O erro 'permission-denied' não deve mais acontecer
      // se a lógica de proteção acima estiver correta
      console.error("Erro ao gerar relatório:", error);
      alert("Erro ao gerar relatório. Verifique o console.");
    } finally {
      setLoading(false);
    }
  }

  // --- 4. EXIBE "CARREGANDO..." ENQUANTO VERIFICA O LOGIN ---
  if (authLoading || !userData) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        Carregando permissões...
      </div>
    );
  }

  // --- 5. REDIRECIONA SE FOR OPERADOR ---
  // (Redundante com o useEffect, mas é uma garantia extra)
  if (userData.role !== 'admin') {
    return (
       <div className="flex h-screen w-full items-center justify-center">
         Redirecionando... Acesso negado.
       </div>
    );
  }

  // --- 6. SE CHEGOU AQUI, É ADMIN E PODE VER A PÁGINA ---
  return (
    <div>
      <h1 className="text-4xl font-bold mb-6">Relatórios Financeiros</h1>
      
      {/* --- Formulário de Filtro de Data --- */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col md:flex-row gap-4 items-end">
              
              <FormField
                control={form.control}
                name="dataInicio"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data Inicial</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-60 pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP", { locale: ptBR })
                            ) : (
                              <span>Escolha uma data</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="dataFim"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data Final</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-60 pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP", { locale: ptBR })
                            ) : (
                              <span>Escolha uma data</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button type="submit" disabled={loading} className="h-10">
                {loading ? "Gerando..." : "Gerar Relatório"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* --- Resumo do Período --- */}
      {loading && <p>Carregando relatório...</p>}
      
      {resumo && (
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-4">Resumo do Período</h2>
          <div className="grid gap-4 md:grid-cols-5">
            {/* Cards de Resumo */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Faturamento Bruto</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  R$ {resumo.faturamentoBruto.toFixed(2)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Custo Peças (Vendido)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-500">
                  R$ {resumo.custoPecas.toFixed(2)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Lucro Bruto</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  R$ {resumo.lucroBruto.toFixed(2)}
                </div>
              </CardContent>
            </Card>
             <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Despesas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  R$ {resumo.saidas.toFixed(2)}
                </div>
              </CardContent>
            </Card>
             <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Lucro Líquido</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  R$ {resumo.lucroLiquido.toFixed(2)}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* --- Tabela de Movimentações --- */}
      {movimentacoes.length > 0 && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4">Todas as Movimentações no Período</h2>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movimentacoes.map((mov) => (
                  <TableRow key={mov.id}>
                    <TableCell>
                      {new Date(mov.data.seconds * 1000).toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell className="capitalize">
                      {mov.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                    </TableCell>
                    <TableCell className="font-medium">{mov.descricao}</TableCell>
                    <TableCell className={cn(
                      mov.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'
                    )}>
                      {mov.tipo === 'entrada' ? '+' : '-'} R$ {mov.valor.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

    </div>
  );
}