// src/app/(dashboard)/page.tsx
"use client";
import Link from "next/link";
import { useState } from "react";
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
  Timestamp,
} from "firebase/firestore";

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

// --- Interface para os resultados (COM NOVOS CAMPOS) ---
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

// --- Schema de Validação (igual) ---
const searchSchema = z.object({
  placa: z.string().min(3, { message: "Digite pelo menos 3 caracteres da placa." }),
});

export default function HomePage() {
  const [resultados, setResultados] = useState<ResultadoOS[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const form = useForm<z.infer<typeof searchSchema>>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      placa: "",
    },
  });

  // --- Função de Busca (igual) ---
  async function onSubmit(values: z.infer<typeof searchSchema>) {
    setLoading(true);
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
      setLoading(false);
    }
  }

  // --- FUNÇÃO: CALCULAR STATUS DA GARANTIA ---
  const getGarantiaStatus = (os: ResultadoOS) => {
    if (os.status !== 'finalizada' || !os.dataFechamento) {
      return <span className="text-gray-500">{os.status}</span>;
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
      <h1 className="text-4xl font-bold mb-6">Consulta Rápida de Garantia</h1>
      <p className="text-lg mb-4">
        Digite a placa do veículo para ver o histórico completo de Ordens de Serviço.
      </p>

      {/* --- Formulário de Busca --- */}
      <Form {...form}>
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
          <Button type="submit" disabled={loading} className="p-6 text-lg">
            {loading ? "Buscando..." : "Buscar"}
          </Button>
        </form>
      </Form>

      {/* --- Área de Resultados --- */}
      {loading && <p>Buscando histórico...</p>}

      {!loading && searched && resultados.length === 0 && (
        <Card className="mt-4">
          <CardContent className="pt-6">
            <p className="text-center text-lg">
              Nenhuma Ordem de Serviço encontrada para esta placa.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && resultados.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Histórico da Placa: {resultados[0].veiculoPlaca}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº OS</TableHead>
                  <TableHead>Data</TableHead>
                  {/* CORREÇÃO AQUI: Comentário movido para dentro do TableHead */}
                  <TableHead>Status Garantia {/* <-- NOVA COLUNA */}</TableHead>
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
  );
}