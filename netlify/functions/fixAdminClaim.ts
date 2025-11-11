// netlify/functions/fixAdminClaim.ts
import { Handler } from "@netlify/functions";
import * as admin from 'firebase-admin';

// (Deixei seu e-mail aqui, que vi no log anterior)
const SEU_EMAIL_ADMIN = "claudesonborges@gmail.com";

let db: admin.firestore.Firestore;
let auth: admin.auth.Auth;
let initializationError: string | null = null;

// --- Configuração do Admin SDK (Corrigida e com Debug) ---
try {
  // 1. Pega as variáveis
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyBase64 = process.env.FIREBASE_PRIVATE_KEY;

  // 2. DEBUG: Verifica se as variáveis existem ANTES de tentar usar
  if (!projectId) throw new Error("Variável de ambiente FIREBASE_PROJECT_ID não foi encontrada.");
  if (!clientEmail) throw new Error("Variável de ambiente FIREBASE_CLIENT_EMAIL não foi encontrada.");
  if (!privateKeyBase64) throw new Error("Variável de ambiente FIREBASE_PRIVATE_KEY não foi encontrada.");

  // 3. Decodifica a chave
  const privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf8');

  // 4. Inicializa o App (apenas se não foi inicializado)
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: projectId,
        clientEmail: clientEmail,
        privateKey: privateKey,
      }),
    });
    console.log("Firebase Admin (fixAdminClaim) inicializado com SUCESSO.");
  }

  // 5. Atribui os serviços AGORA QUE TEMOS CERTEZA QUE FUNCIONOU
  db = admin.firestore();
  auth = admin.auth();

} catch (e: any) {
  // 6. SE FALHAR, guarda o erro
  console.error("ERRO CRÍTICO AO INICIALIZAR FIREBASE ADMIN (fixAdminClaim):", e.message);
  initializationError = e.message;
}
// --- Fim da Configuração ---


const handler: Handler = async () => {
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
  if (!SEU_EMAIL_ADMIN.includes('@')) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "ERRO: A variável SEU_EMAIL_ADMIN no topo do arquivo da função está incorreta." }),
    };
  }

  try {
    console.log(`Buscando usuário: ${SEU_EMAIL_ADMIN}`);
    const user = await auth.getUserByEmail(SEU_EMAIL_ADMIN);

    await auth.setCustomUserClaims(user.uid, { role: 'admin' });
    
    const userDocRef = db.collection('usuarios').doc(user.uid);
    await userDocRef.set({ role: 'admin' }, { merge: true });

    console.log(`Sucesso! Usuário ${user.email} (UID: ${user.uid}) agora é admin no Token e no Firestore.`);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Sucesso! O usuário ${user.email} agora tem a 'role' de admin. Por favor, faça logout e login novamente.` }),
    };

  } catch (error: any) {
    console.error("Erro ao definir claim de admin:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

export { handler };