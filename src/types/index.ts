// src/types/index.ts
import { Timestamp } from "firebase/firestore";

// Tipo do Usuário (Auth)
export interface UserData {
  id: string;
  nome: string;
  email: string;
  role: "admin" | "operador";
}

// Tipo de Clientes
export interface Cliente {
  id: string;
  nome: string;
  telefone?: string;
  cpfCnpj?: string;
  email?: string;
  ownerId?: string;
}

// Tipo de Veículos
export interface Carro {
  id: string;
  modelo: string;
  placa: string;
  ano?: string;
  cor?: string;
  clienteId: string;
  nomeCliente?: string; // Desnormalizado para facilitar buscas
  ownerId?: string;
}

// Tipo de Produtos/Peças
export interface Produto {
  id: string;
  nome: string;
  codigoSku?: string;
  descricao?: string;
  precoCusto: number;
  precoVenda: number;
  estoqueAtual: number;
  estoqueMinimo?: number;
  tipo: "peca" | "servico";
  monitorarEstoque?: boolean;
}

// Item dentro da OS (Sub-documento)
export interface ItemOS {
  id: string;
  nome: string;
  qtde: number;
  precoCusto: number;
  precoUnitario: number;
  tipo: "peca" | "servico";
  estoqueAtual?: number; // Auxiliar para validação no front
}

// A Ordem de Serviço em si
export interface OrdemDeServico {
  id: string;
  numeroOS: number;
  dataAbertura: Timestamp | { seconds: number }; // Aceita ambos para evitar erros de tipagem
  dataFechamento?: Timestamp | { seconds: number };
  clienteId: string;
  nomeCliente: string;
  veiculoPlaca: string;
  veiculoModelo?: string;
  status: "aberta" | "finalizada" | "cancelada";
  servicosDescricao?: string;
  garantiaDias?: number;
  itens: ItemOS[];
  valorTotal: number;
  custoTotal?: number;
  ownerId?: string;
}

// Movimentações Financeiras
export interface Movimentacao {
  id: string;
  data: Timestamp | { seconds: number };
  tipo: "entrada" | "saida";
  descricao: string;
  valor: number;
  categoria?: string;
  formaPagamento?: string;
  ownerId?: string;
}