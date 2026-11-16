/* Conexão com o Firebase (login + banco de dados) */
import { initializeApp } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, sendPasswordResetEmail, signOut,
  EmailAuthProvider, reauthenticateWithCredential, updatePassword, useDeviceLanguage,
} from 'firebase/auth';
import {
  initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot,
} from 'firebase/firestore';
import { firebaseConfig } from './config.js';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
try { useDeviceLanguage(auth); } catch (e) { /* ignora */ }

let fs;
try {
  fs = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
} catch (e) {
  console.warn('cache local indisponível', e);
  fs = getFirestore(app);
}

/* Sem internet, o Firestore guarda a gravação no aparelho e só confirma quando volta a conexão.
   Para a tela não ficar travada esperando, depois de 4 s seguimos (a gravação continua na fila). */
const ate = (p) => Promise.race([p, new Promise((r) => setTimeout(() => r('fila'), 4000))]);

function snapDoc(d) {
  return { id: d.id, exists: d.exists(), data: () => d.data(), metadata: d.metadata };
}
function refDoc(r) {
  return {
    id: r.id,
    path: r.path,
    get: () => getDoc(r).then(snapDoc),
    set: (data) => ate(setDoc(r, data)),
    update: (data) => ate(updateDoc(r, data)),
    delete: () => ate(deleteDoc(r)),
  };
}
function refCol(c) {
  return {
    path: c.path,
    doc: (id) => refDoc(id ? doc(c, id) : doc(c)),
    add: (data) => { const r = doc(c); return ate(setDoc(r, data)).then(() => refDoc(r)); },
    onSnapshot: (next, err) => onSnapshot(c, { includeMetadataChanges: true }, (s) => next({
      docs: s.docs.map(snapDoc), size: s.size, empty: s.empty, metadata: s.metadata,
    }), err),
  };
}
export const DB = {
  doc: (p) => refDoc(doc(fs, p)),
  collection: (p) => refCol(collection(fs, p)),
};

export const Conta = {
  aoMudar: (fn) => onAuthStateChanged(auth, fn),
  entrar: (email, senha) => signInWithEmailAndPassword(auth, email, senha),
  redefinir: (email) => sendPasswordResetEmail(auth, email),
  sair: () => signOut(auth),
  async trocarSenha(atual, nova) {
    const u = auth.currentUser;
    if (!u) throw { code: 'auth/no-current-user' };
    await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, atual));
    await updatePassword(u, nova);
  },
};
