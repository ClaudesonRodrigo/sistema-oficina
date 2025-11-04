// src/app/(dashboard)/despesas/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { collection, addDoc, onSnapshot, query, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Componentes Shadcn
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

// --- Interface para Movimentação ---
interface Movimentacao {
  id: string;
  data: Timestamp;
  descricao: string;
  valor: number;
  formaPagamento: string;
}

// --- Schema de Validação ZOD (CORRIGIDO PARA BUILD) ---
// --- Schema de Validação ZOD (versão final e estável) ---
// --- Schema de Validação ZOD (versão final e compatível) ---
const despesaSchema = z.object({
  descricao: z
    .string()
    .min(3, "Descreva a despesa."),

  // ✅ Converte string automaticamente em número
  // ✅ Funciona mesmo que o usuário digite "25,50"
  valor: z.coerce
    .number()
    .pipe(
      z.number().min(0.01, "O valor deve ser maior que zero.")
    ),

  formaPagamento: z.enum(["pix", "dinheiro", "cartao_debito"]),
});



export default function DespesasPage() {
  const [despesasHoje, setDespesasHoje] = useState<Movimentacao[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Efeito para buscar as despesas de HOJE ---
  useEffect(() => {
    setLoading(true);
    
    const hoje = new Date();
    const inicioDoDia = new Date(hoje.setHours(0, 0, 0, 0));
    const fimDoDia = new Date(hoje.setHours(23, 59, 59, 999));

    const movRef = collection(db, "movimentacoes");
    
    const q = query(
      movRef,
      where("tipo", "==", "saida"),
      where("data", ">=", inicioDoDia),
      where("data", "<=", fimDoDia)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const listaDespesas: Movimentacao[] = [];
      snapshot.forEach((doc) => {
        listaDespesas.push({ id: doc.id, ...doc.data() } as Movimentacao);
      });
      setDespesasHoje(listaDespesas);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // --- Configuração do Formulário de Despesa ---
  const form = useForm<z.infer<typeof despesaSchema>>({
    resolver: zodResolver(despesaSchema), // Linha 92 (agora correta)
    defaultValues: {
      descricao: "",
      valor: undefined, // <-- CORREÇÃO: Inicializa como undefined para o placeholder
      formaPagamento: "dinheiro",
    },
  });

  // --- Função de Salvar Despesa ---
  async function onSubmit(values: z.infer<typeof despesaSchema>) {
    try {
      await addDoc(collection(db, "movimentacoes"), {
        data: new Date(),
        tipo: "saida",
        descricao: values.descricao,
        valor: values.valor, // O Zod já garantiu que 'valor' é um número
        formaPagamento: values.formaPagamento,
      });

      console.log("Despesa registrada com sucesso!");
      form.reset();

    } catch (error) {
      console.error("Erro ao registrar despesa:", error);
    }
  }

  return (
    <div>
      <h1 className="text-4xl font-bold mb-6">Lançar Despesas (Saídas)</h1>
      
      {/* --- Formulário de Nova Despesa --- */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col md:flex-row gap-4 items-end">
              <FormField
                control={form.control}
                name="descricao"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Descrição da Despesa</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Compra de café" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="valor"
                render={({ field }) => (
                  <FormItem className="w-full md:w-auto">
                    <FormLabel>Valor (R$)</FormLabel>
                    <FormControl>
                      {/* Mudamos para type="text" para aceitar vírgula, o Zod vai tratar */}
                      <Input type="text" placeholder="25,50" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="formaPagamento"
                render={({ field }) => (
                  <FormItem className="w-full md:w-auto">
                    <FormLabel>Forma de Pagamento</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="dinheiro">Dinheiro</SelectItem>
                        <SelectItem value="pix">Pix</SelectItem>
                        <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={form.formState.isSubmitting} className="h-10">
                {form.formState.isSubmitting ? "Salvando..." : "Registrar Saída"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>


      {/* --- Tabela de Despesas de Hoje --- */}
      <h2 className="text-2xl font-bold mb-4">Despesas Registradas Hoje</h2>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hora</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead>Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={4} className="text-center">
                  Carregando...
                </TableCell>
              </TableRow>
            )}
            {!loading && despesasHoje.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center">
                  Nenhuma despesa registrada hoje.
                </TableCell>
              </TableRow>
            )}
            {!loading && despesasHoje.map((despesa) => (
              <TableRow key={despesa.id}>
                <TableCell>
                  {new Date(despesa.data.seconds * 1000).toLocaleTimeString()}
                </TableCell>
                <TableCell className="font-medium">{despesa.descricao}</TableCell>
                <TableCell>{despesa.formaPagamento}</TableCell>
                <TableCell className="text-red-600">
                  - R$ {despesa.valor.toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}