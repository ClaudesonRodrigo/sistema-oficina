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

// --- Interface para os resultados da busca ---
// (Usamos a mesma estrutura da OS)
interface ResultadoOS {
  id: string;
  numeroOS: number;
  dataAbertura: { seconds: number }; // Formato do Firestore Timestamp
  nomeCliente: string;
  veiculoPlaca: string; // Adicionado para exibir na tabela
  servicosDescricao?: string;
  status: string;
  valorTotal: number;
}

// --- Schema de Validação do formulário de busca ---
const searchSchema = z.object({
  placa: z.string().min(3, { message: "Digite pelo menos 3 caracteres da placa." }),
});

export default function HomePage() {
  const [resultados, setResultados] = useState<ResultadoOS[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false); // Para saber se já buscou

  const form = useForm<z.infer<typeof searchSchema>>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      placa: "",
    },
  });

  // --- Função de Busca pela Placa ---
  async function onSubmit(values: z.infer<typeof searchSchema>) {
    setLoading(true);
    setSearched(true); // Marca que uma busca foi feita
    setResultados([]); // Limpa resultados anteriores

    try {
      // 1. Cria a consulta no Firestore
      const osRef = collection(db, "ordensDeServico");
      const q = query(
        osRef,
        where("veiculoPlaca", "==", values.placa.toUpperCase()), // Busca pela placa exata (convertida para maiúscula)
        orderBy("dataAbertura", "desc") // Ordena pela mais recente
      );

      // 2. Executa a consulta
      const querySnapshot = await getDocs(q);

      // 3. Formata os resultados
      const listaResultados: ResultadoOS[] = [];
      querySnapshot.forEach((doc) => {
        listaResultados.push({ id: doc.id, ...doc.data() } as ResultadoOS);
      });

      setResultados(listaResultados);
    } catch (error) {
      console.error("Erro ao buscar OS por placa: ", error);
      // TODO: Mostrar toast de erro
    } finally {
      setLoading(false);
    }
  }

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
            <p className="text-center text-lg">Nenhuma Ordem de Serviço encontrada para esta placa.</p>
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
                  <TableHead>Data</TableHead>
                  <TableHead>Nº OS</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Serviços</TableHead>
                  <TableHead>Valor Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultados.map((os) => (
                  <TableRow key={os.id}>
                    <TableCell>
                      {new Date(os.dataAbertura.seconds * 1000).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Link href={`/os/${os.id}`} className="font-medium text-primary hover:underline">
                        {os.numeroOS}
                      </Link>
                    </TableCell>
                    <TableCell>{os.status}</TableCell>
                    <TableCell>{os.nomeCliente}</TableCell>
                    <TableCell>{os.servicosDescricao || "N/A"}</TableCell>
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