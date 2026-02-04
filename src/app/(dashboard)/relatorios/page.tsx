// src/app/(dashboard)/relatorios/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { collection, query, where, getDocs, Timestamp, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, AlertTriangle } from "lucide-react"; // Adicionei ícone de alerta

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

// --- Interface UserData ---
interface UserData {
  id: string;
  nome: string;
  email: string;
  role: "admin" | "operador";
}

// --- Schema de Validação ZOD ---
const reportSchema = z.object({
  dataInicio: z.date(),
  dataFim: z.date(),
  operadorId: z.string().default("todos"), 
});

// --- FUNÇÃO HELPER DE FORMATAÇÃO (NOVIDADE) ---
const formatarMoeda = (valor: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
};

export default function RelatoriosPage() {
  const [resumo, setResumo] = useState<ResumoCaixa | null>(null);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [usuarios, setUsuarios] = useState<UserData[]>([]); 

  const { userData, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && userData && userData.role !== 'admin') {
      router.push('/'); 
    }
  }, [userData, authLoading, router]);

  // --- useEffect para buscar usuários ---
  useEffect(() => {
    if (userData?.role === 'admin') {
      const unsub = onSnapshot(collection(db, "usuarios"), (snapshot) => {
        const lista: UserData[] = [];
        snapshot.forEach((doc) => {
          lista.push({ id: doc.id, ...doc.data() } as UserData);
        });
        setUsuarios(lista);
      });
      return () => unsub();
    }
  }, [userData]); 

  // --- Configuração do Formulário de Data ---
  const form = useForm<z.infer<typeof reportSchema>>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      dataInicio: startOfDay(new Date()),
      dataFim: endOfDay(new Date()),
      operadorId: "todos",
    },
  });

  // --- Função de Busca por Período ---
  async function onSubmit(values: z.infer<typeof reportSchema>) {
    setLoading(true);
    setResumo(null);
    setMovimentacoes([]);

    const { dataInicio, dataFim, operadorId } = values;

    try {
      const movRef = collection(db, "movimentacoes");

      let queryConstraints = [
        where("data", ">=", startOfDay(dataInicio)),
        where("data", "<=", endOfDay(dataFim))
      ];
  
      if (operadorId !== "todos") {
        queryConstraints.push(where("ownerId", "==", operadorId));
      }

      // Firestore permite passar array de constraints espalhado
      const q = query(movRef, ...queryConstraints);
      
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
      
      // Ordenar por data (mais recente primeiro) para a tabela ficar lógica
      listaMovimentacoes.sort((a, b) => b.data.seconds - a.data.seconds);

      setMovimentacoes(listaMovimentacoes);
    } catch (error) {
      console.error("Erro ao gerar relatório:", error);
      alert("Erro ao gerar relatório. Verifique o console.");
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || !userData) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        Carregando permissões...
      </div>
    );
  }

  if (userData.role !== 'admin') {
    return (
       <div className="flex h-screen w-full items-center justify-center">
         Redirecionando... Acesso negado.
       </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl md:text-4xl font-bold mb-6">Relatórios Financeiros</h1>
      
      {/* --- Formulário de Filtro de Data --- */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col md:flex-row gap-4 items-end">
              
              <FormField
                control={form.control}
                name="dataInicio"
                render={({ field }) => (
                  <FormItem className="flex flex-col w-full md:w-60">
                    <FormLabel>Data Inicial</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full md:w-60 pl-3 text-left font-normal",
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
                  <FormItem className="flex flex-col w-full md:w-60">
                    <FormLabel>Data Final</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full md:w-60 pl-3 text-left font-normal",
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
                name="operadorId"
                render={({ field }) => (
                  <FormItem className="flex flex-col w-full md:w-60">
                    <FormLabel>Operador</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full md:w-60">
                          <SelectValue placeholder="Filtrar por operador" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="todos">Todos os Operadores</SelectItem>
                        {usuarios.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button type="submit" disabled={loading} className="h-10 w-full md:w-auto">
                {loading ? "Gerando..." : "Gerar Relatório"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* --- Resumo do Período --- */}
      {loading && <p>Carregando dados...</p>}
      
      {resumo && (
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-4">Resumo do Período</h2>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3 lg:grid-cols-5">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Faturamento Bruto</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {formatarMoeda(resumo.faturamentoBruto)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Custo Peças</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-500">
                  {formatarMoeda(resumo.custoPecas)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Lucro Bruto</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatarMoeda(resumo.lucroBruto)}
                </div>
              </CardContent>
            </Card>
             <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Despesas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatarMoeda(resumo.saidas)}
                </div>
              </CardContent>
            </Card>
             <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Lucro Líquido</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatarMoeda(resumo.lucroLiquido)}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* --- Tabela de Movimentações (Otimizada) --- */}
      {movimentacoes.length > 0 && (
        <div className="mt-8">
          <div className="flex justify-between items-center mb-4">
             <h2 className="text-2xl font-bold">Detalhamento</h2>
             {/* Aviso de Otimização */}
             <div className="flex items-center text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
               <AlertTriangle className="h-4 w-4 mr-2" />
               Exibindo as últimas 50 movimentações para otimizar a performance.
             </div>
          </div>

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
                {/* OTIMIZAÇÃO: Limitando a renderização apenas aos primeiros 50 itens */}
                {movimentacoes.slice(0, 50).map((mov) => (
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
                      {mov.tipo === 'entrada' ? '+ ' : '- '} 
                      {formatarMoeda(mov.valor)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="text-center mt-4 text-sm text-gray-500">
            Total de registros encontrados no período: {movimentacoes.length}
          </div>
        </div>
      )}

    </div>
  );
}