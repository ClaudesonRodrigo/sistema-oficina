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

// --- Interface para os resultados da busca ---
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

// --- Interface para o Resumo do Caixa ---
interface ResumoCaixa {
  entradas: number;
  saidas: number;
  saldo: number;
}

// --- Schema de Validação do formulário de busca ---
const searchSchema = z.object({
  placa: z.string().min(3, { message: "Digite pelo menos 3 caracteres da placa." }),
});

export default function HomePage() {
  const { userData } = useAuth();
  const isAdmin = userData?.role === 'admin';
  const [resumoCaixa, setResumoCaixa] = useState<ResumoCaixa>({
    entradas: 0,
    saidas: 0,
    saldo: 0,
  });
  const [loadingCaixa, setLoadingCaixa] = useState(true);

  const [resultados, setResultados] = useState<ResultadoOS[]>([]);
  const [loadingBusca, setLoadingBusca] = useState(false);
  const [searched, setSearched] = useState(false);

  // --- Efeito para buscar movimentações (só Admin) ---
  useEffect(() => {
    if (isAdmin) {
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
        let entradas = 0;
        let saidas = 0;

        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.tipo === "entrada") {
            entradas += data.valor;
          } else if (data.tipo === "saida") {
            saidas += data.valor;
          }
        });

        setResumoCaixa({
          entradas: entradas,
          saidas: saidas,
          saldo: entradas - saidas,
        });
        setLoadingCaixa(false);
      });

      return () => unsub();
    } else {
      setLoadingCaixa(false); 
    }
  }, [isAdmin]);

  // --- Configuração do Formulário de Busca ---
  const form = useForm<z.infer<typeof searchSchema>>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      placa: "",
    },
  });

  // --- Função de Busca por Placa ---
  async function onSubmit(values: z.infer<typeof searchSchema>) {
    setLoadingBusca(true);
    setSearched(true);
    setResultados([]);

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

      setResultados(listaResultados);
    } catch (error) {
      console.error("Erro ao buscar OS por placa: ", error);
    } finally {
      setLoadingBusca(false);
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
      {/* --- Resumo do Caixa (Só Admin) --- */}
      {isAdmin && (
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-6">Resumo do Dia</h1>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Entradas (Hoje)</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingCaixa ? (
                  <p>Carregando...</p>
                ) : (
                  <div className="text-2xl font-bold text-green-600">
                    R$ {resumoCaixa.entradas.toFixed(2)}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Saídas (Hoje)</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingCaixa ? (
                  <p>Carregando...</p>
                ) : (
                  <div className="text-2xl font-bold text-red-600">
                    R$ {resumoCaixa.saidas.toFixed(2)}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Saldo em Caixa (Hoje)</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingCaixa ? (
                  <p>Carregando...</p>
                ) : (
                  <div className="text-2xl font-bold">
                    R$ {resumoCaixa.saldo.toFixed(2)}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* --- CONSULTA DE GARANTIA (EXISTENTE) --- */}
      <div className="mt-8">
        <h1 className="text-4xl font-bold mb-6">Consulta Rápida de Garantia</h1>
        <p className="text-lg mb-4">
          Digite a placa do veículo para ver o histórico completo de Ordens de
          Serviço.
        </p>

        {/* --- Formulário de Busca (CORRIGIDO) --- */}
        {/* O <Form> é o wrapper */}
        <Form {...form}>
          {/* O <form> recebe o onSubmit e o className */}
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex gap-4 mb-8">
            <FormField
              control={form.control}
              name="placa"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input
                      placeholder="Digite a placa (ex: ABC-1234)"
                      {...field}
                      className="text-lg p-6"
                      autoComplete="off"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={loadingBusca} className="p-6 text-lg">
              {loadingBusca ? "Buscando..." : "Buscar"}
            </Button>
          </form>
        </Form>

        {/* --- Área de Resultados --- */}
        {loadingBusca && <p>Buscando histórico...</p>}

        {!loadingBusca && searched && resultados.length === 0 && (
          <Card className="mt-4">
            <CardContent className="pt-6">
              <p className="text-center text-lg">
                Nenhuma Ordem de Serviço encontrada para esta placa.
              </p>
            </CardContent>
          </Card>
        )}

        {!loadingBusca && resultados.length > 0 && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>
                Histórico da Placa: {resultados[0].veiculoPlaca}
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
                  {resultados.map((os) => (
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