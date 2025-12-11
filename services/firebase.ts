import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAE-4VdpqA7JlqCLSNpyxq6aidAuxQ-nJw",
  authDomain: "fusionhub-t5zmrz.firebaseapp.com",
  projectId: "fusionhub-t5zmrz",
  storageBucket: "fusionhub-t5zmrz.firebasestorage.app",
  messagingSenderId: "216171285073",
  appId: "1:216171285073:web:c1b8547155ac8011eb4670"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);