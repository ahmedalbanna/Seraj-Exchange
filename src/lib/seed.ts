import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export async function seedInitialData() {
  const branchesSnap = await getDocs(collection(db, 'branches'));
  
  if (branchesSnap.empty) {
    console.log("Seeding initial data...");
    
    // Seed Branches
    const branches = [
      { name: 'فرع المركز الرئيسي - صنعاء', location: 'شارع الزبيري', balances: { USD: 50000, SAR: 200000, YER: 10000000 } },
      { name: 'فرع عدن - كريتر', location: 'شارع الملكة أروى', balances: { USD: 30000, SAR: 150000, YER: 15000000 } },
      { name: 'فرع حضرموت - المكلا', location: 'حي السلام', balances: { USD: 20000, SAR: 100000, YER: 5000000 } },
      { name: 'فرع تعز - شارع جمال', location: 'وسط المدينة', balances: { USD: 15000, SAR: 80000, YER: 3000000 } }
    ];

    for (const branch of branches) {
      await addDoc(collection(db, 'branches'), branch);
    }

    // Seed Initial Rates
    const rates = [
      { baseCurrency: 'USD', targetCurrency: 'YER', officialRate: 530, marketRate: 535, updatedBy: 'system', date: serverTimestamp() },
      { baseCurrency: 'SAR', targetCurrency: 'YER', officialRate: 140, marketRate: 142, updatedBy: 'system', date: serverTimestamp() }
    ];

    for (const rate of rates) {
      await addDoc(collection(db, 'exchange_rates'), rate);
    }
    
    console.log("Seeding completed!");
  }
}
