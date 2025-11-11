import { Handler, HandlerEvent } from "@netlify/functions";
import * as admin from 'firebase-admin';

// Interface para os dados que o frontend vai enviar
interface OSData {
  novaOS: {
    numeroOS: number;
    dataAbertura: Date;
    status: string;
    clienteId: string;
    nomeCliente: string;
    veiculoPlaca: string;
    veiculoModelo: string;
    servicosDescricao: string;
    garantiaDias: number;
    itens: any[]; // Itens simplificados para a OS
    valorTotal: number;
    custoTotal: number;
  };
  itens: any[]; // Itens completos do formulário (com estoqueAtual)
}

// Inicializa o "Super-Admin" do Firebase
// Ele só é inicializado uma vez, mesmo que a função "esquente"
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Corrige a formatação da chave privada lida do Netlify
        privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
      }),
    });
  } catch (e) {
    console.error("Erro ao inicializar Firebase Admin:", e);
  }
}

const db = admin.firestore();

const handler: Handler = async (event: HandlerEvent) => {
  // 1. Apenas aceita requisições POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método não permitido' }) };
  }

  // 2. Tenta executar a lógica de transação
  try {
    if (!event.body) {
      throw new Error("Corpo da requisição vazio.");
    }
    
    const { novaOS, itens } = JSON.parse(event.body) as OSData;

    // 3. A MESMA LÓGICA DE TRANSAÇÃO, MAS AGORA NO SERVIDOR!
    // Como estamos usando o Admin SDK, as "Regras do Firestore" são ignoradas
    // para esta função, permitindo que ela atualize o estoque.
    
    await db.runTransaction(async (transaction) => {
      // Converte a data (que vem como string no JSON) de volta para Timestamp do Firebase
      novaOS.dataAbertura = new Date(novaOS.dataAbertura);
      
      const osRef = db.collection("ordensDeServico").doc();
      // Salva a OS principal
      transaction.set(osRef, novaOS);
      
      // Itera nos itens para abater o estoque
      for (const item of itens) {
        // Só mexe no estoque se for 'peca'
        if (item.tipo === "peca") {
          const produtoRef = db.collection("produtos").doc(item.id);
          const produtoDoc = await transaction.get(produtoRef); // Lê o estoque ATUAL

          if (!produtoDoc.exists) {
            throw new Error(`Produto ${item.nome} (ID: ${item.id}) não foi encontrado no banco de dados.`);
          }
          
          const estoqueAtual = produtoDoc.data()!.estoqueAtual;
          const novoEstoque = estoqueAtual - item.qtde;

          // Validação de segurança no backend
          if (novoEstoque < 0) {
            throw new Error(`Estoque insuficiente para ${item.nome}. Restam apenas ${estoqueAtual}.`);
          }
          
          // Abate o estoque
          transaction.update(produtoRef, { estoqueAtual: novoEstoque });
        }
      }
    });

    // 4. Retorna sucesso
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "OS criada e estoque abatido com sucesso!" }),
    };

  } catch (error: any) {
    console.error("Erro na Netlify Function criarOS:", error);
    // 5. Retorna o erro exato (ex: "Estoque insuficiente...")
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Erro interno do servidor." }),
    };
  }
};

export { handler };