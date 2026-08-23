import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ExchangeRate } from '../types';
import { handleFirestoreError } from './errorService';

export const exchangeRateService = {
  subscribeToRates: (callback: (rates: ExchangeRate[]) => void, count: number = 20) => {
    const q = query(collection(db, 'exchange_rates'), orderBy('date', 'desc'), limit(count));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as ExchangeRate)));
    }, (error) => {
      console.error("Error subscribing to exchange rates", error);
    });
  },

  addRate: async (rate: Omit<ExchangeRate, 'id' | 'date' | 'updatedBy'> & { updatedBy: string }) => {
    // Client-side validation mirrors firestore.rules:isValidExchangeRate
    if (!rate.baseCurrency || rate.baseCurrency.length !== 3) throw new Error("baseCurrency must be 3 chars");
    if (!rate.targetCurrency || rate.targetCurrency.length !== 3) throw new Error("targetCurrency must be 3 chars");
    if (rate.baseCurrency === rate.targetCurrency) throw new Error("baseCurrency and targetCurrency must differ");
    if (rate.officialRate <= 0 || rate.marketRate <= 0) throw new Error("Rates must be > 0");
    if (!rate.updatedBy) throw new Error("updatedBy required");

    try {
      const docRef = await addDoc(collection(db, 'exchange_rates'), {
        baseCurrency: rate.baseCurrency.toUpperCase(),
        targetCurrency: rate.targetCurrency.toUpperCase(),
        officialRate: rate.officialRate,
        marketRate: rate.marketRate,
        updatedBy: rate.updatedBy,
        date: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, 'create', 'exchange_rates');
    }
  },
};
