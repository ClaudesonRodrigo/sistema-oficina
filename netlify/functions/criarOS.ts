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
  };
  itens: any[];
}

let db: admin.firestore.Firestore;
let initializationError: string | null = null;

// --- Configuração do Admin SDK (Corrigida e com Debug) ---
try {
  // 1. Pega as variáveis
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyBase64 = process.env.FIREBASE_PRIVATE_KEY;

  // 2. DEBUG: Verifica se as variáveis existem
  if (!projectId) throw new Error("Variável de ambiente FIREBASE_PROJECT_ID não foi encontrada.");
  if (!clientEmail) throw new Error("Variável de ambiente FIREBASE_CLIENT_EMAIL não foi encontrada.");
  if (!privateKeyBase64) throw new Error("Variável de ambiente FIREBASE_PRIVATE_KEY não foi encontrada.");

  // 3. Decodifica a chave
  const privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf8');

  // 4. Inicializa o App
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: projectId,
        clientEmail: clientEmail,
        privateKey: privateKey,
      }),
    });
    console.log("Firebase Admin (criarOS) inicializado com SUCESSO.");
  }

  // 5. Atribui os serviços
  db = admin.firestore();

} catch (e: any) {
  // 6. SE FALHAR, guarda o erro
  console.error("ERRO CRÍTICO AO INICIALIZAR FIREBASE ADMIN (criarOS):", e.message);
  initializationError = e.message;
}
// --- Fim da Configuração ---


const handler: Handler = async (event: HandlerEvent) => {
  // 7. Adiciona uma verificação no início do handler
  if (!db || initializationError) {
     const errorMsg = `ERRO: O Firebase Admin não foi inicializado. Causa: ${initializationError || "Erro desconhecido"}`;
     console.error(errorMsg);
     return {
       statusCode: 500,
       body: JSON.stringify({ error: errorMsg }),
     };
  }

  // --- O resto da sua função ---
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método não permitido' }) };
  }

  try {
    if (!event.body) {
      throw new Error("Corpo da requisição vazio.");
    }
    
    const { novaOS, itens } = JSON.parse(event.body) as OSData;
    
    await db.runTransaction(async (transaction) => {
      novaOS.dataAbertura = new Date(novaOS.dataAbertura);
      
      const osRef = db.collection("ordensDeServico").doc();
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