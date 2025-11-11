// netlify/functions/criarOS.ts
import { Handler, HandlerEvent } from "@netlify/functions";
import * as admin from 'firebase-admin';

// Interface
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
    itens: any[];
    valorTotal: number;
    custoTotal: number;
    ownerId: string; // ATUALIZADO: Campo de segurança
  };
  itens: any[]; // Itens completos do formulário (com estoqueAtual)
}

let db: admin.firestore.Firestore;
let initializationError: string | null = null;

// --- Configuração do Admin SDK (Sem Base64) ---
try {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY; 

  if (!projectId) throw new Error("Variável de ambiente FIREBASE_PROJECT_ID não foi encontrada.");
  if (!clientEmail) throw new Error("Variável de ambiente FIREBASE_CLIENT_EMAIL não foi encontrada.");
  if (!privateKey) throw new Error("Variável de ambiente FIREBASE_PRIVATE_KEY não foi encontrada.");

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: projectId,
        clientEmail: clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'), // Correção p/ Netlify
      }),
    });
    console.log("Firebase Admin (criarOS) inicializado com SUCESSO.");
  }

  db = admin.firestore();

} catch (e: any) {
  console.error("ERRO CRÍTICO AO INICIALIZAR FIREBASE ADMIN (criarOS):", e.message);
  initializationError = e.message;
}
// --- Fim da Configuração ---


const handler: Handler = async (event: HandlerEvent) => {
  if (!db || initializationError) {
     const errorMsg = `ERRO: O Firebase Admin não foi inicializado. Causa: ${initializationError || "Erro desconhecido"}`;
     console.error(errorMsg);
     return {
       statusCode: 500,
       body: JSON.stringify({ error: errorMsg }),
     };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método não permitido' }) };
  }

  try {
    if (!event.body) {
      throw new Error("Corpo da requisição vazio.");
    }
    
    const { novaOS, itens } = JSON.parse(event.body) as OSData;
    
    await db.runTransaction(async (transaction) => {
      // Converte a data (que vem como string no JSON) de volta para Timestamp
      novaOS.dataAbertura = new Date(novaOS.dataAbertura);
      
      const osRef = db.collection("ordensDeServico").doc();
      // Salva a OS (que agora contém o ownerId vindo do frontend)
      transaction.set(osRef, novaOS); 
      
      for (const item of itens) {
        if (item.tipo === "peca") {
          const produtoRef = db.collection("produtos").doc(item.id);
          const produtoDoc = await transaction.get(produtoRef);

          if (!produtoDoc.exists) {
            throw new Error(`Produto ${item.nome} (ID: ${item.id}) não foi encontrado no banco de dados.`);
          }
          
          const estoqueAtual = produtoDoc.data()!.estoqueAtual;
          const novoEstoque = estoqueAtual - item.qtde;

          if (novoEstoque < 0) {
            throw new Error(`Estoque insuficiente para ${item.nome}. Restam apenas ${estoqueAtual}.`);
          }
          
          transaction.update(produtoRef, { estoqueAtual: novoEstoque });
        }
      }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "OS criada e estoque abatido com sucesso!" }),
    };

  } catch (error: any) {
    console.error("Erro na Netlify Function criarOS:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Erro interno do servidor." }),
    };
  }
};

export { handler };