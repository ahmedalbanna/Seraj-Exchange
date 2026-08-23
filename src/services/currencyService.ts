import { collection, query, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Currency } from '../types';
import { handleFirestoreError } from './errorService';

export const currencyService = {
  subscribeToCurrencies: (callback: (currencies: Currency[]) => void) => {
    const q = query(collection(db, 'currencies'));
    return onSnapshot(q, (snapshot) => {
      const currencies = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Currency[];
      callback(currencies);
    }, (error) => {
      console.error("Error subscribing to currencies", error);
    });
  },

  addCurrency: async (currency: Omit<Currency, 'id'>) => {
    if (!currency.code || currency.code.length < 3) throw new Error("Currency code must be >=3 chars");
    if (!currency.name) throw new Error("Currency name required");
    if (!currency.symbol) throw new Error("Currency symbol required");
    try {
      await addDoc(collection(db, 'currencies'), {
        code: currency.code.toUpperCase(),
        name: currency.name,
        symbol: currency.symbol,
        isActive: currency.isActive ?? true,
      });
    } catch (error) {
      handleFirestoreError(error, 'create', 'currencies');
    }
  },

  updateCurrency: async (id: string, updates: Partial<Currency>) => {
    try {
      const docRef = doc(db, 'currencies', id);
      await updateDoc(docRef, updates);
    } catch (error) {
      handleFirestoreError(error, 'update', `currencies/${id}`);
    }
  },

  deleteCurrency: async (id: string) => {
    try {
      const docRef = doc(db, 'currencies', id);
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, 'delete', `currencies/${id}`);
    }
  }
};
