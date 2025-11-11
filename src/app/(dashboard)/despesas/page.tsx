// src/app/(dashboard)/despesas/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod"; 
import { z } from "zod";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// --- 1. IMPORTAÇÕES DE AUTENTICAÇÃO E ROTEAMENTO ---
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

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
  ownerId?: string; // ATUALIZADO
}

// --- Schema de Validação ZOD ---
const despesaSchema = z.object({
  descricao: z.string().min(3, "Descreva a despesa."),
  valor: z.preprocess(
    (val) => {
      // Se for string (do input), limpa e converte
      if (typeof val === 'string') {
        // Se a string estiver vazia, retorna undefined para o Zod tratar
        if (val.trim() === "") return undefined;
        // Substitui vírgula por ponto (importante no Brasil) e converte
        const num = parseFloat(val.replace(',', '.'));
        // Se a conversão falhar (ex: "abc"), retorna NaN para o Zod pegar
        return isNaN(num) ? undefined : num;
      }
      // Se já for número, só repassa
      if (typeof val === 'number') {
        return val;
      }
      // Se for qualquer outra coisa (undefined, null), falha na validação
      return undefined;
    },
    z.number()
     .min(0.01, "O valor deve ser maior que zero.")
  ),
  formaPagamento: z.enum(["pix", "dinheiro", "cartao_debito"]),
});

export default function DespesasPage() {
  const [despesasHoje, setDespesasHoje] = useState<Movimentacao[]>([]);
  // Renomeado para evitar conflito
  const [listLoading, setListLoading] = useState(true);

  // --- 2. GUARDIÃO DE ROTA (O "PORTEIRO") ---
  const { userData, loading: authLoading } = useAuth();
  const router = useRouter();

  if (authLoading) {
    // Se está checando o login, mostra tela de carregamento
    return (
      <div className="flex h-screen w-full items-center justify-center">
        Carregando permissões...
      </div>
    );
  }

  // Esta página é SÓ para admin (conforme regra 'movimentacoes')
  if (!userData || userData.role !== 'admin') {
    router.push('/');
    return (
       <div className="flex h-screen w-full items-center justify-center">
         Acesso negado. Redirecionando...
       </div>
    );
  }
  // --- FIM DO GUARDIÃO ---


  // --- Efeito para buscar as despesas de HOJE (ATUALIZADO) ---
  useEffect(() => {
    // O guardião acima garante que 'userData' existe e é admin
    if (userData) {
      setListLoading(true);

      const hoje = new Date();
      const inicioDoDia = new Date(hoje.setHours(0, 0, 0, 0));
      const fimDoDia = new Date(hoje.setHours(23, 59, 59, 999));

      const movRef = collection(db, "movimentacoes");

      const q = query(
        movRef,
        where("tipo", "==", "saida"),
        where("data", ">=", inicioDoDia),
        where("data", "<=", fimDoDia),
        where("ownerId", "==", userData.id) // ATUALIZADO: Filtro de segurança
      );

      const unsub = onSnapshot(q, (snapshot) => {
        const listaDespesas: Movimentacao[] = [];
        snapshot.forEach((doc) => {
          listaDespesas.push({ id: doc.id, ...doc.data() } as Movimentacao);
        });
        setDespesasHoje(listaDespesas);
        setListLoading(false);
      }, (error) => {
        // Este erro não deve mais acontecer
        console.error("Erro ao buscar despesas (verifique regras): ", error);
        setListLoading(false);
      });

      return () => unsub();
    }
  }, [userData]); // Roda quando 'userData' for carregado

  // --- Configuração do Formulário de Despesa ---
  const form = useForm<z.infer<typeof despesaSchema>>({
    resolver: zodResolver(despesaSchema), 
    defaultValues: {
      descricao: "",
      valor: NaN, 
      formaPagamento: "dinheiro",
    },
  });

  // --- Função de Salvar Despesa (ATUALIZADO) ---
  async function onSubmit(values: z.infer<typeof despesaSchema>) {
    if (!userData) {
      alert("Erro: Usuário não autenticado.");
      return;
    }
    
    try {
      await addDoc(collection(db, "movimentacoes"), {
        data: new Date(),
        tipo: "saida",
        descricao: values.descricao,
        valor: values.valor, 
        formaPagamento: values.formaPagamento,
        ownerId: userData.id // ATUALIZADO: Salva o 'ownerId'
      });

      console.log("Despesa registrada com sucesso!");
      form.reset();
    } catch (error) {
      console.error("Erro ao registrar despesa:", error);
    }
  }

  // --- Renderização (Se chegou aqui, é ADMIN) ---
  return (
    <div>
      <h1 className="text-4xl font-bold mb-6">Lançar Despesas (Saídas)</h1>

      {/* --- Formulário de Nova Despesa --- */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col md:flex-row gap-4 items-end"
            >
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
                      <Input 
                        type="text" 
                        placeholder="25,50" 
                        {...field}
                        value={isNaN(field.value) ? '' : field.value} 
                      />
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
            {listLoading && (
              <TableRow>
                <TableCell colSpan={4} className="text-center">
                  Carregando...
                </TableCell>
              </TableRow>
            )}
            {!listLoading && despesasHoje.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center">
                  Nenhuma despesa registrada hoje.
                </TableCell>
              </TableRow>
            )}
            {!listLoading && despesasHoje.map((despesa) => (
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