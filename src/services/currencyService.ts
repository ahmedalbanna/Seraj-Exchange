import { collection, query, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Currency } from '../types';

export const currencyService = {
  subscribeToCurrencies: (callback: (currencies: Currency[]) => void) => {
    const q = query(collection(db, 'currencies'));
    return onSnapshot(q, (snapshot) => {
      const currencies = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Currency[];
      callback(currencies);
    });
  },

  addCurrency: async (currency: Omit<Currency, 'id'>) => {
    await addDoc(collection(db, 'currencies'), currency);
  },

  updateCurrency: async (id: string, updates: Partial<Currency>) => {
    const docRef = doc(db, 'currencies', id);
    await updateDoc(docRef, updates);
  },

  deleteCurrency: async (id: string) => {
    const docRef = doc(db, 'currencies', id);
    await deleteDoc(docRef);
  }
};
