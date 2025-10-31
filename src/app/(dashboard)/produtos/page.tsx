  // src/app/produtos/page.tsx
"use client";

// 1. IMPORTAÇÕES NOVAS (useState, useEffect)
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Importações do Firebase (NOSSA CONEXÃO)
import { db } from "@/lib/firebase";
// 2. IMPORTAÇÕES NOVAS (collection, addDoc, onSnapshot)
import { collection, addDoc, onSnapshot } from "firebase/firestore"; 

// Importações dos componentes Shadcn
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
// import { toast } from "sonner"; // Descomentar se tiver instalado o Sonner

// DEFININDO A "CARA" DO NOSSO PRODUTO (para o TypeScript)
interface Produto {
  id: string; // O ID do documento no Firebase
  nome: string;
  codigoSku?: string;
  precoVenda: number;
  estoqueAtual: number;
}

// DEFININDO O "CONTRATO" (SCHEMA) DO NOSSO FORMULÁRIO
const formSchema = z.object({
  nome: z.string().min(3, { message: "O nome deve ter pelo menos 3 caracteres." }),
  codigoSku: z.string().optional(),
  precoVenda: z.coerce.number().min(0, { message: "O preço deve ser positivo." }),
  estoqueAtual: z.coerce.number().int({ message: "O estoque deve ser um número inteiro." }),
});

export default function ProdutosPage() {
  // Estado para controlar se o modal está aberto ou fechado
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // 3. ESTADO PARA GUARDAR OS PRODUTOS VINDOS DO FIREBASE
  const [produtos, setProdutos] = useState<Produto[]>([]);

  // 4. LIGANDO O "OUVINTE" DO FIREBASE (A MÁGICA EM TEMPO REAL)
  useEffect(() => {
    // "unsub" é uma função para "desligar" o ouvinte quando a página fechar
    const unsub = onSnapshot(collection(db, "produtos"), (querySnapshot) => {
      const listaDeProdutos: Produto[] = [];
      querySnapshot.forEach((doc) => {
        // Pega os dados do documento E o seu ID
        listaDeProdutos.push({
          id: doc.id,
          ...doc.data()
        } as Produto); // Informa ao TypeScript que esses dados são um "Produto"
      });
      setProdutos(listaDeProdutos); // Atualiza nosso estado com os dados do banco
    });

    // Função de limpeza (desliga o ouvinte quando o componente "morre")
    return () => unsub();
  }, []); // O array vazio [] faz isso rodar só uma vez, quando a página carrega

  // Configurando o "cérebro" do formulário
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      codigoSku: "",
      precoVenda: 0,
      estoqueAtual: 0,
    },
  });

  // A FUNÇÃO DE SALVAR (Continua igual)
  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const dadosCompletos = {
        ...values,
        tipo: 'peca',
        precoCusto: 0, 
        ncm: '', 
      }

      const docRef = await addDoc(collection(db, "produtos"), dadosCompletos);
      console.log("Produto salvo com ID: ", docRef.id);
      // toast.success("Produto salvo com sucesso!");

      form.reset();
      setIsModalOpen(false);

    } catch (error) {
      console.error("Erro ao salvar produto: ", error);
      // toast.error("Erro ao salvar produto.");
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-bold">Produtos e Peças</h1>
        
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button>Adicionar Novo Produto</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Adicionar Novo Produto</DialogTitle>
              <DialogDescription>
                Preencha as informações da nova peça ou serviço.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                
                <FormField
                  control={form.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Produto</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Filtro de Ar" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="codigoSku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código (SKU)</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: SKU123" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="precoVenda"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preço de Venda (R$)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="estoqueAtual"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estoque Atual</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button 
                    type="submit" 
                    disabled={form.formState.isSubmitting}
                  >
                    {form.formState.isSubmitting ? "Salvando..." : "Salvar Produto"}
                  </Button>
                </DialogFooter>

              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* ===== 5. TABELA LENDO DADOS DO FIREBASE (NÃO MAIS DO MOCK) ===== */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Código (SKU)</TableHead>
              <TableHead>Estoque</TableHead>
              <TableHead>Preço (R$)</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* MUDANÇA PRINCIPAL AQUI: lendo de "produtos" (do estado) */}
            {produtos.map((produto) => (
              <TableRow key={produto.id}>
                <TableCell className="font-medium">{produto.nome}</TableCell>
                <TableCell>{produto.codigoSku}</TableCell>
                <TableCell>{produto.estoqueAtual}</TableCell>
                <TableCell>{produto.precoVenda.toFixed(2)}</TableCell>
                <TableCell>{/* TODO: Botões de Editar/Excluir */}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

    </div>
  );
}