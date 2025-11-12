// src/app/(dashboard)/caixa/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  query,
  where,
  Timestamp,
  addDoc,
  Query, // Importa o tipo 'Query'
} from "firebase/firestore";
import { db } from "@/lib/firebase";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

// Componentes Shadcn
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

// --- INTERFACE ATUALIZADA ---
interface OrdemDeServico {
  id: string;
  numeroOS: number;
  dataAbertura: { seconds: number };
  nomeCliente: string;
  placaVeiculo: string;
  status: "aberta" | "finalizada" | "cancelada";
  valorTotal: number;
  custoTotal: number; 
  ownerId?: string; 
}

// --- Schema de Validação ZOD para o pagamento ---
const pagamentoSchema = z.object({
  formaPagamento: z.enum(["pix", "dinheiro", "cartao_debito", "cartao_credito"]),
});

export default function CaixaPage() {
  const [osAbertas, setOsAbertas] = useState<OrdemDeServico[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedOS, setSelectedOS] = useState<OrdemDeServico | null>(null);

  // --- GUARDIÃO DE ROTA (O "PORTEIRO") ---
  const { userData, loading: authLoading } = useAuth();
  const router = useRouter();

  if (authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        Carregando permissões...
      </div>
    );
  }
  if (!userData) { 
    router.push('/login');
    return (
       <div className="flex h-screen w-full items-center justify-center">
         Redirecionando...
       </div>
    );
  }
  // --- FIM DO GUARDIÃO ---

  // --- Efeito para buscar OS "abertas" (ATUALIZADO COM LÓGICA DE ADMIN) ---
  useEffect(() => {
    if (userData) {
      setLoading(true);
      const isAdmin = userData.role === 'admin';
      const osRef = collection(db, "ordensDeServico");
      
      let q: Query;
      
      if (isAdmin) {
        // ADMIN: Busca TODAS as OSs abertas
        q = query(osRef, where("status", "==", "aberta"));
      } else {
        // OPERADOR: Busca SÓ as suas OSs abertas
        q = query(
          osRef, 
          where("status", "==", "aberta"),
          where("ownerId", "==", userData.id)
        );
      }

      const unsub = onSnapshot(q, (snapshot) => {
        const listaOS: OrdemDeServico[] = [];
        snapshot.forEach((doc) => {
          listaOS.push({ id: doc.id, ...doc.data() } as OrdemDeServico);
        });
        setOsAbertas(listaOS);
        setLoading(false);
      });

      return () => unsub();
    }
  }, [userData]); // Roda quando 'userData' for carregado

  // --- Configuração do Formulário de Pagamento ---
  const form = useForm<z.infer<typeof pagamentoSchema>>({
    resolver: zodResolver(pagamentoSchema),
    defaultValues: {
      formaPagamento: "dinheiro",
    },
  });

  // --- FUNÇÃO DE FINALIZAR PAGAMENTO (Sem mudanças) ---
  async function onSubmit(values: z.infer<typeof pagamentoSchema>) {
    if (!selectedOS || !userData) {
      alert("Erro: OS ou Usuário não selecionado.");
      return;
    }

    const dataFinalizacao = new Date();

    try {
      // --- PASSO 1: ATUALIZAR A ORDEM DE SERVIÇO ---
      const osDocRef = doc(db, "ordensDeServico", selectedOS.id);
      await updateDoc(osDocRef, {
        status: "finalizada",
        formaPagamento: values.formaPagamento,
        dataFechamento: dataFinalizacao,
      });
      console.log("OS finalizada com sucesso!");

      // --- PASSO 2: REGISTRAR "ENTRADA" NO LIVRO CAIXA ---
      await addDoc(collection(db, "movimentacoes"), {
        data: dataFinalizacao,
        tipo: "entrada",
        descricao: `Venda OS #${selectedOS.numeroOS}`,
        valor: selectedOS.valorTotal,
        custo: selectedOS.custoTotal || 0,
        formaPagamento: values.formaPagamento,
        referenciaId: selectedOS.id, 
        ownerId: selectedOS.ownerId || userData.id // Usa o ownerId da OS, ou o do caixa se falhar
      });
      console.log("Movimentação de entrada registrada!");

      // --- Limpeza do formulário ---
      setSelectedOS(null);
      form.reset();
      
    } catch (error) {
      console.error("Erro ao finalizar OS e registrar movimentação:", error);
    }
  }

  // --- Renderização ---
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-bold">Frente de Caixa</h1>
      </div>
      <p className="text-lg mb-4">
        Ordens de serviço aguardando pagamento.
      </p>

      {/* --- Tabela de OS Abertas --- */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº OS</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Placa</TableHead>
              <TableHead>Valor Total</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center">
                  Carregando...
                </TableCell>
              </TableRow>
            )}
            {!loading && osAbertas.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center">
                  Nenhuma OS aguardando pagamento.
                </TableCell>
              </TableRow>
            )}
            {/* Agora lista TODAS (admin) ou SÓ AS SUAS (operador) */}
            {!loading && osAbertas.map((os) => (
              <TableRow key={os.id}>
                <TableCell>{os.numeroOS}</TableCell>
                <TableCell>
                  {new Date(os.dataAbertura.seconds * 1000).toLocaleDateString()}
                </TableCell>
                <TableCell className="font-medium">{os.nomeCliente}</TableCell>
                <TableCell>{os.placaVeiculo}</TableCell>
                <TableCell>R$ {os.valorTotal.toFixed(2)}</TableCell>
                <TableCell>
                  <Button size="sm" onClick={() => setSelectedOS(os)}>
                    Registrar Pagamento
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* --- Modal de Registro de Pagamento --- */}
      <Dialog
        open={!!selectedOS}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setSelectedOS(null);
            form.reset();
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Finalizar OS: {selectedOS?.numeroOS}</DialogTitle>
            <DialogDescription>
              Cliente: {selectedOS?.nomeCliente} <br />
              Placa: {selectedOS?.placaVeiculo}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <h3 className="text-3xl font-bold text-center mb-6">
              Total: R$ {selectedOS?.valorTotal.toFixed(2)}
            </h3>

            <Form {...form}>
              <form id="pagamentoForm" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="formaPagamento"
                  render={({ field }) => (
                    <FormItem>
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
                          <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              form="pagamentoForm" 
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? "Finalizando..." : "Finalizar Pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}