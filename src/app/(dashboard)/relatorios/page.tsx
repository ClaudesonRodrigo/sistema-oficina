// src/app/(dashboard)/relatorios/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
// ATUALIZADO: Importar 'Query'
import { collection, query, where, getDocs, Timestamp, onSnapshot, Query } from "firebase/firestore";
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
// ATUALIZADO: Importar componentes do Select
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

// --- ATUALIZADO: Adicionar interface UserData ---
interface UserData {
  id: string;
  nome: string;
  email: string;
  role: "admin" | "operador";
}

// --- Schema de Validação ZOD (ATUALIZADO) ---
const reportSchema = z.object({
  dataInicio: z.date(),
  dataFim: z.date(),
  operadorId: z.string().default("todos"), // <-- CAMPO NOVO
});

export default function RelatoriosPage() {
  const [resumo, setResumo] = useState<ResumoCaixa | null>(null);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [usuarios, setUsuarios] = useState<UserData[]>([]); // <-- STATE NOVO

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

  // --- ATUALIZADO: Adicionar useEffect para buscar usuários ---
  useEffect(() => {
    // Este useEffect busca os usuários para o filtro
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
  }, [userData]); // Roda quando o admin carrega

  // --- Configuração do Formulário de Data (ATUALIZADO) ---
  const form = useForm<z.infer<typeof reportSchema>>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      dataInicio: startOfDay(new Date()),
      dataFim: endOfDay(new Date()),
      operadorId: "todos", // <-- VALOR PADRÃO NOVO
    },
  });

  // --- Função de Busca por Período (ATUALIZADA) ---
  async function onSubmit(values: z.infer<typeof reportSchema>) {
    setLoading(true);
    setResumo(null);
    setMovimentacoes([]);

    // Pega os 3 valores do formulário
    const { dataInicio, dataFim, operadorId } = values;

    try {
      const movRef = collection(db, "movimentacoes");

      // 1. Começa com a query base (data)
      let queryConstraints = [
        where("data", ">=", startOfDay(dataInicio)),
        where("data", "<=", endOfDay(dataFim))
      ];
  
      // 2. Adiciona o filtro de operador SE não for "todos"
      if (operadorId !== "todos") {
        queryConstraints.push(where("ownerId", "==", operadorId));
      }

      // 3. Monta a query final
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
      setMovimentacoes(listaMovimentacoes);
    } catch (error) {
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

              {/* --- ATUALIZADO: CAMPO DE FILTRO DE OPERADOR --- */}
              <FormField
                control={form.control}
                name="operadorId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Operador</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-60">
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