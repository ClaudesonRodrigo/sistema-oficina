// src/app/(dashboard)/vendas/page.tsx
"use client";

import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, limit, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Receipt, Printer, Eye, Search, AlertCircle, Loader2 } from "lucide-react";

// UI Components
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

// Interfaces
interface ItemVenda {
  id: string;
  nome: string;
  qtde: number;
  precoVenda: number;
}

interface Venda {
  id: string;
  data: any; // Firestore Timestamp
  itens: ItemVenda[];
  total: number;
  formaPagamento: string;
  operadorNome: string;
  ownerId: string;
  tipo: string;
}

// Formatador Universal
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
};

export default function VendasHistoryPage() {
  const { userData, loading: authLoading } = useAuth();
  
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [vendaSelecionada, setVendaSelecionada] = useState<Venda | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Carregar as vendas do banco de dados
  useEffect(() => {
    if (!userData) return;

    const vendasRef = collection(db, "vendas");
    let q;

    if (userData.role === 'admin') {
      q = query(vendasRef, orderBy("data", "desc"), limit(50));
    } else {
      q = query(vendasRef, where("ownerId", "==", userData.id), orderBy("data", "desc"), limit(50));
    }

    const unsub = onSnapshot(q, (snapshot) => {
      const listaVendas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Venda));
      setVendas(listaVendas);
    }, (error) => {
      console.error("Erro ao buscar vendas:", error);
      toast.error("Erro ao carregar o histórico de vendas.");
    });

    return () => unsub();
  }, [userData]);

  // Filtro Rápido no Frontend (por operador ou forma de pagamento)
  const vendasFiltradas = vendas.filter(v => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      v.operadorNome?.toLowerCase().includes(term) || 
      v.formaPagamento?.toLowerCase().includes(term) ||
      v.id.toLowerCase().includes(term)
    );
  });

  const abrirDetalhes = (venda: Venda) => {
    setVendaSelecionada(venda);
    setIsModalOpen(true);
  };

  // A Lógica Ninja de Reimprimir o Recibo!
  const handleReprint = () => {
    if (!vendaSelecionada) return;

    const janelaImpressao = window.open('', '_blank', 'width=400,height=600');
    if (!janelaImpressao) {
      toast.error("O navegador bloqueou a impressão. Permita os pop-ups!");
      return;
    }

    // Formatar a data (pode ser Timestamp do Firebase ou Date normal)
    const dataVenda = vendaSelecionada.data?.toDate ? vendaSelecionada.data.toDate() : new Date(vendaSelecionada.data);

    const linhasItens = vendaSelecionada.itens.map(item => `
      <tr>
        <td style="padding-bottom: 4px;">${item.qtde}x ${item.nome}</td>
        <td style="text-align: right; padding-bottom: 4px;">${item.precoVenda.toFixed(2)}</td>
        <td style="text-align: right; font-weight: bold; padding-bottom: 4px;">${(item.qtde * item.precoVenda).toFixed(2)}</td>
      </tr>
    `).join('');

    janelaImpressao.document.write(`
      <html>
        <head>
          <title>2ª Via - Recibo</title>
          <style>
            @page { margin: 0; }
            body { font-family: monospace; margin: 0; padding: 10px; width: 80mm; font-size: 12px; color: #000; }
            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            th { text-align: left; border-bottom: 1px dashed #000; padding-bottom: 4px; }
            .text-right { text-align: right; }
            .center { text-align: center; }
            .linha-tracejada { border-top: 1px dashed #000; margin: 8px 0; }
          </style>
        </head>
        <body>
          <div class="center">
            <h2 style="margin: 0; font-size: 16px;">RODRIGO SKAP</h2>
            <p style="margin: 2px 0;">avenida Euclides Figueiredo,439, Aracaju</p>
            <p style="margin: 2px 0; font-weight: bold;">*** 2ª VIA DE RECIBO ***</p>
            <p style="margin: 2px 0;">Data: ${dataVenda.toLocaleDateString('pt-BR')} ${dataVenda.toLocaleTimeString('pt-BR')}</p>
            <p style="margin: 2px 0;">Operador: ${vendaSelecionada.operadorNome || "N/A"}</p>
            <p style="margin: 2px 0;">ID: #${vendaSelecionada.id.slice(0, 6).toUpperCase()}</p>
          </div>
          
          <div class="linha-tracejada"></div>
          
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th class="text-right">Unit</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${linhasItens}
            </tbody>
          </table>
          
          <div class="linha-tracejada"></div>
          
          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 14px;">
            <span>TOTAL:</span>
            <span>R$ ${vendaSelecionada.total.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-top: 4px; text-transform: uppercase;">
            <span>Pagamento:</span>
            <span>${vendaSelecionada.formaPagamento}</span>
          </div>
          
          <div class="linha-tracejada"></div>
          
          <div class="center" style="margin-top: 15px; font-style: italic;">
            <p style="margin: 2px 0;">Obrigado pela preferência!</p>
            <p style="margin: 2px 0;">Volte Sempre</p>
          </div>
          
          <div style="margin-top: 30px;" class="center">.</div>
        </body>
      </html>
    `);

    janelaImpressao.document.close();
    janelaImpressao.focus();

    setTimeout(() => {
      janelaImpressao.print();
      janelaImpressao.close();
    }, 500);
  };

  if (authLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h1 className="text-4xl font-bold flex items-center gap-3">
          <Receipt className="h-8 w-8 text-blue-600" />
          Histórico do PDV
        </h1>
        
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <Input 
            placeholder="Buscar por ID, Operador ou Pagamento..." 
            className="pl-10 h-12 text-lg"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card className="shadow-sm border-2 border-gray-100">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>ID Venda</TableHead>
                <TableHead>Data e Hora</TableHead>
                <TableHead>Operador</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Itens (Qtd)</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-[100px] text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendasFiltradas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-gray-500 text-lg">
                    Nenhuma venda encontrada no histórico.
                  </TableCell>
                </TableRow>
              ) : (
                vendasFiltradas.map((venda) => {
                  const dataVenda = venda.data?.toDate ? venda.data.toDate() : new Date();
                  const totalItens = venda.itens?.reduce((acc, item) => acc + item.qtde, 0) || 0;

                  return (
                    <TableRow key={venda.id} className="hover:bg-slate-50">
                      <TableCell className="font-mono text-sm font-bold text-gray-600">
                        #{venda.id.slice(0, 6).toUpperCase()}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{format(dataVenda, 'dd/MM/yyyy')}</div>
                        <div className="text-xs text-gray-500">{format(dataVenda, 'HH:mm')}</div>
                      </TableCell>
                      <TableCell className="capitalize">{venda.operadorNome || "N/A"}</TableCell>
                      <TableCell>
                        <span className="bg-gray-100 px-3 py-1 rounded-full text-xs font-bold uppercase text-gray-700 border">
                          {venda.formaPagamento}
                        </span>
                      </TableCell>
                      <TableCell>{totalItens} unid.</TableCell>
                      <TableCell className="text-right font-black text-green-700 text-lg">
                        {formatCurrency(venda.total)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button variant="outline" size="icon" onClick={() => abrirDetalhes(venda)} title="Ver Detalhes e Imprimir">
                          <Eye className="h-5 w-5 text-blue-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* MODAL DE DETALHES DA VENDA */}
      {vendaSelecionada && (
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-2xl border-b pb-4">
                <Receipt className="h-6 w-6 text-blue-600" />
                Detalhes da Venda
              </DialogTitle>
              <DialogDescription className="pt-2">
                ID da Venda: <span className="font-mono font-bold text-black">#{vendaSelecionada.id.toUpperCase()}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="bg-slate-50 p-4 rounded-lg border space-y-3 mt-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Operador:</span>
                <span className="font-bold capitalize">{vendaSelecionada.operadorNome || "N/A"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Data e Hora:</span>
                <span className="font-bold">
                  {vendaSelecionada.data?.toDate 
                    ? format(vendaSelecionada.data.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Forma de Pagamento:</span>
                <span className="font-bold uppercase text-blue-600">{vendaSelecionada.formaPagamento}</span>
              </div>
            </div>

            <div className="mt-4">
              <h4 className="font-bold text-gray-700 mb-2">Itens Vendidos</h4>
              <div className="max-h-48 overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader className="bg-gray-100">
                    <TableRow>
                      <TableHead>Qtd x Item</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendaSelecionada.itens?.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <span className="font-bold mr-2">{item.qtde}x</span>
                          {item.nome}
                          <div className="text-xs text-gray-500">Unit: {formatCurrency(item.precoVenda)}</div>
                        </TableCell>
                        <TableCell className="text-right font-bold text-gray-700">
                          {formatCurrency(item.qtde * item.precoVenda)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex justify-between items-center mt-4 border-t pt-4">
              <span className="text-lg text-gray-600 font-bold">Total da Venda:</span>
              <span className="text-3xl font-black text-green-700">
                {formatCurrency(vendaSelecionada.total)}
              </span>
            </div>

            <DialogFooter className="mt-6 flex gap-2 sm:justify-between">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                Fechar
              </Button>
              <Button onClick={handleReprint} className="bg-blue-600 hover:bg-blue-700 gap-2">
                <Printer className="h-5 w-5" />
                Imprimir 2ª Via
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Aviso de Performance */}
      <div className="flex items-center justify-center text-sm text-gray-500 gap-2 p-2">
        <AlertCircle className="h-4 w-4" />
        <span>Mostrando as últimas 50 vendas para otimização do sistema.</span>
      </div>
    </div>
  );
}