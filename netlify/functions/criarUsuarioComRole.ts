// netlify/functions/criarUsuarioComRole.ts
import { Handler, HandlerEvent } from "@netlify/functions";
import * as admin from 'firebase-admin';

let db: admin.firestore.Firestore;
let auth: admin.auth.Auth;
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
    console.log("Firebase Admin (criarUsuarioComRole) inicializado com SUCESSO.");
  }

  // 5. Atribui os serviços
  db = admin.firestore();
  auth = admin.auth();

} catch (e: any) {
  // 6. SE FALHAR, guarda o erro
  console.error("ERRO CRÍTICO AO INICIALIZAR FIREBASE ADMIN (criarUsuarioComRole):", e.message);
  initializationError = e.message;
}
// --- Fim da Configuração ---


const handler: Handler = async (event: HandlerEvent) => {
  // 7. Adiciona uma verificação no início do handler
  if (!auth || !db || initializationError) {
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