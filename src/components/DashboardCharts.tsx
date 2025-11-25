"use client";

import { useState, useEffect } from "react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { startOfMonth, subMonths, format, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

// Cores para o gráfico de pizza
const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];

export default function DashboardCharts() {
  const [faturamentoData, setFaturamentoData] = useState<any[]>([]);
  const [lucroData, setLucroData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const hoje = new Date();
        const seisMesesAtras = startOfMonth(subMonths(hoje, 5));

        // --- 1. DADOS PARA O GRÁFICO DE BARRAS (Faturamento x Despesas) ---
        const movRef = collection(db, "movimentacoes");
        const qMov = query(movRef, where("data", ">=", seisMesesAtras));
        const movSnap = await getDocs(qMov);

        const dadosMensais: Record<string, { name: string; Vendas: number; Despesas: number }> = {};

        // Inicializa os últimos 6 meses com zero
        for (let i = 5; i >= 0; i--) {
          const mesRef = subMonths(hoje, i);
          const chave = format(mesRef, "yyyy-MM");
          const nome = format(mesRef, "MMM", { locale: ptBR }).toUpperCase();
          dadosMensais[chave] = { name: nome, Vendas: 0, Despesas: 0 };
        }

        movSnap.forEach((doc) => {
          const data = doc.data();
          const dataMov = data.data.toDate();
          const chave = format(dataMov, "yyyy-MM");

          if (dadosMensais[chave]) {
            if (data.tipo === "entrada") {
              dadosMensais[chave].Vendas += data.valor;
            } else if (data.tipo === "saida") {
              dadosMensais[chave].Despesas += data.valor;
            }
          }
        });

        setFaturamentoData(Object.values(dadosMensais));

        // --- 2. DADOS PARA O GRÁFICO DE PIZZA (Peças x Serviços) ---
        // Aqui precisamos olhar as OS finalizadas para saber o detalhe
        const osRef = collection(db, "ordensDeServico");
        // Pegamos OS finalizadas dos últimos 30 dias para o gráfico de pizza ser mais "atual"
        const trintaDiasAtras = startOfMonth(subMonths(hoje, 1)); 
        const qOS = query(
          osRef, 
          where("status", "==", "finalizada"),
          where("dataFechamento", ">=", Timestamp.fromDate(trintaDiasAtras))
        );
        const osSnap = await getDocs(qOS);

        let totalPecas = 0;
        let totalServicos = 0;

        osSnap.forEach((doc) => {
          const os = doc.data();
          // Itera sobre os itens da OS para somar
          if (os.itens) {
             os.itens.forEach((item: any) => {
                const valorItem = (item.precoUnitario || 0) * (item.qtde || 0);
                if (item.tipo === "peca") {
                   totalPecas += valorItem;
                } else {
                   totalServicos += valorItem;
                }
             });
          }
        });

        setLucroData([
          { name: "Peças", value: totalPecas },
          { name: "Serviços", value: totalServicos },
        ]);

      } catch (error) {
        console.error("Erro ao buscar dados dos gráficos:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    // Um esqueleto simples de carregamento
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <div className="h-[350px] bg-gray-100 rounded-xl animate-pulse"></div>
        <div className="h-[350px] bg-gray-100 rounded-xl animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
      
      {/* --- GRÁFICO 1: FATURAMENTO (BARRAS) --- */}
      <Card>
        <CardHeader>
          <CardTitle>Faturamento vs Despesas (6 Meses)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={faturamentoData}
                margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip 
                  formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px' }}
                />
                <Legend />
                <Bar dataKey="Vendas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* --- GRÁFICO 2: ORIGEM DA RECEITA (PIZZA) --- */}
      <Card>
        <CardHeader>
          <CardTitle>Origem da Receita (Últimos 30 dias)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full flex justify-center items-center">
            {lucroData.every(d => d.value === 0) ? (
               <p className="text-gray-500">Sem dados suficientes neste período.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={lucroData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {lucroData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}