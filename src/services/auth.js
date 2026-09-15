import {
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { auth } from '../firebase.js';

const STAFF_DOMAIN = 'iesjosepsuredaiblanes.com';

export async function signInPantalles() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ hd: STAFF_DOMAIN, prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
    return true;
  } catch (error) {
    if (error?.code === 'auth/popup-blocked') {
      throw new Error("Safari ha bloquejat l'inici de sessió. Permet les finestres emergents i torna-ho a provar.");
    }
    if (error?.code === 'auth/cancelled-popup-request') return false;
    if (error?.code !== 'auth/popup-closed-by-user') throw error;
    return false;
  }
}
