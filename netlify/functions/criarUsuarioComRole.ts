// netlify/functions/criarUsuarioComRole.ts
import { Handler, HandlerEvent } from "@netlify/functions";
import * as admin from 'firebase-admin';

let db: admin.firestore.Firestore;
let auth: admin.auth.Auth;
let initializationError: string | null = null;

// --- Configuração do Admin SDK (Corrigida com .replace()) ---
try {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY; // Chave "crua"

  if (!projectId) throw new Error("Variável de ambiente FIREBASE_PROJECT_ID não foi encontrada.");
  if (!clientEmail) throw new Error("Variável de ambiente FIREBASE_CLIENT_EMAIL não foi encontrada.");
  if (!privateKey) throw new Error("Variável de ambiente FIREBASE_PRIVATE_KEY não foi encontrada.");

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: projectId,
        clientEmail: clientEmail,
        // --- ESTA É A CORREÇÃO DA SUA PESQUISA (Seção 1.3) ---
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
    console.log("Firebase Admin (criarUsuarioComRole) inicializado com SUCESSO.");
  }

  db = admin.firestore();
  auth = admin.auth();

} catch (e: any) {
  console.error("ERRO CRÍTICO AO INICIALIZAR FIREBASE ADMIN (criarUsuarioComRole):", e.message);
  initializationError = e.message;
}
// --- Fim da Configuração ---


const handler: Handler = async (event: HandlerEvent) => {
  if (!auth || !db || initializationError) {
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
    const { nome, email, password, role } = JSON.parse(event.body!);
    
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      displayName: nome,
    });
    
    const uid = userRecord.uid;
    await auth.setCustomUserClaims(uid, { role: role });

    const userDocRef = db.collection('usuarios').doc(uid);
    await userDocRef.set({
      nome: nome,
      email: email,
      role: role,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Usuário criado com sucesso!", uid: uid }),
    };

  } catch (error: any) {
    console.error("Erro na Netlify Function criarUsuarioComRole:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

export { handler };