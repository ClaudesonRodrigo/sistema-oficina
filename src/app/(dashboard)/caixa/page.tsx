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
} from "firebase/firestore";
import { db } from "@/lib/firebase";

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

// --- Interfaces ---
interface OrdemDeServico {
  id: string;
  numeroOS: number;
  dataAbertura: { seconds: number };
  nomeCliente: string;
  placaVeiculo: string;
  status: "aberta" | "finalizada" | "cancelada";
  valorTotal: number;
}

// --- Schema de Validação ZOD para o pagamento ---
const pagamentoSchema = z.object({
  formaPagamento: z.enum(["pix", "dinheiro", "cartao_debito", "cartao_credito"]),
});

export default function CaixaPage() {
  const [osAbertas, setOsAbertas] = useState<OrdemDeServico[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estado para controlar qual OS está sendo paga no modal
  const [selectedOS, setSelectedOS] = useState<OrdemDeServico | null>(null);

  // --- Efeito para buscar OS "abertas" ---
  useEffect(() => {
    setLoading(true);
    const osRef = collection(db, "ordensDeServico");
    
    // Query para buscar apenas onde status == "aberta"
    const q = query(osRef, where("status", "==", "aberta"));

    const unsub = onSnapshot(q, (snapshot) => {
      const listaOS: OrdemDeServico[] = [];
      snapshot.forEach((doc) => {
        listaOS.push({ id: doc.id, ...doc.data() } as OrdemDeServico);
      });
      setOsAbertas(listaOS);
      setLoading(false);
    });

    return () => unsub(); // Limpa o "ouvinte"
  }, []);

  // --- Configuração do Formulário de Pagamento ---
  const form = useForm<z.infer<typeof pagamentoSchema>>({
    resolver: zodResolver(pagamentoSchema),
    defaultValues: {
      formaPagamento: "dinheiro",
    },
  });

  // --- Função de Finalizar Pagamento ---
  async function onSubmit(values: z.infer<typeof pagamentoSchema>) {
    if (!selectedOS) return;

    try {
      const osDocRef = doc(db, "ordensDeServico", selectedOS.id);

      // Atualiza o documento
      await updateDoc(osDocRef, {
        status: "finalizada",
        formaPagamento: values.formaPagamento,
        dataFechamento: new Date(), // Salva a data de hoje
      });

      console.log("OS finalizada com sucesso!");
      // TODO: Adicionar toast de sucesso
      
      // Fecha o modal e limpa o formulário
      setSelectedOS(null);
      form.reset();

    } catch (error) {
      console.error("Erro ao finalizar OS:", error);
      // TODO: Adicionar toast de erro
    }
  }

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
              form="pagamentoForm" // Faz este botão enviar o formulário
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