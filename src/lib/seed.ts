import { collection, getDocs, doc, getDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';

export async function seedInitialData() {
  // Gate: only attempt when branches collection is readable (requires verified user)
  let branchesSnap;
  try {
    branchesSnap = await getDocs(collection(db, 'branches'));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('permission-denied') || msg.includes('Missing or insufficient permissions')) {
      console.log("Seed skipped: insufficient permissions to read branches (login as verified user first)");
      return;
    }
    console.error("Seed read failed", e);
    return;
  }
  
  if (!branchesSnap.empty) return;

  console.log("Seeding initial data... empty branches detected");

  // Gate: must be authenticated and Administrator (branches write requires isAdministrator per firestore.rules:132)
  const user = auth.currentUser;
  if (!user) {
    console.log("Seed deferred: no authenticated user — will retry after login");
    return;
  }
  if (!user.emailVerified) {
    console.log("Seed deferred: email not verified");
    return;
  }
  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const role = userDoc.data()?.role;
    if (role !== 'Administrator') {
      console.log(`Seed skipped: user role '${role}' is not Administrator — ask an admin to seed`);
      return;
    }
  } catch (e) {
    console.error("Seed role check failed", e);
    return;
  }

  // Use deterministic IDs so AuthProvider default and rules isValidId remain consistent
  // 'main' is the canonical branchId for new Tellers and must exist
  const branches: Array<{ id: string; data: Record<string, unknown> }> = [
    { id: 'main', data: { name: 'فرع المركز الرئيسي - صنعاء', location: 'شارع الزبيري', balances: { USD: 50000, SAR: 200000, YER: 10000000 } } },
    { id: 'branch-aden', data: { name: 'فرع عدن - كريتر', location: 'شارع الملكة أروى', balances: { USD: 30000, SAR: 150000, YER: 15000000 } } },
    { id: 'branch-mukalla', data: { name: 'فرع حضرموت - المكلا', location: 'حي السلام', balances: { USD: 20000, SAR: 100000, YER: 5000000 } } },
    { id: 'branch-taiz', data: { name: 'فرع تعز - شارع جمال', location: 'وسط المدينة', balances: { USD: 15000, SAR: 80000, YER: 3000000 } } }
  ];

  const rates = [
    { baseCurrency: 'USD', targetCurrency: 'YER', officialRate: 530, marketRate: 535, updatedBy: user.uid, date: serverTimestamp() },
    { baseCurrency: 'SAR', targetCurrency: 'YER', officialRate: 140, marketRate: 142, updatedBy: user.uid, date: serverTimestamp() }
  ];

  try {
    const batch = writeBatch(db);
    for (const b of branches) {
      batch.set(doc(db, 'branches', b.id), b.data);
    }
    for (const r of rates) {
      batch.set(doc(collection(db, 'exchange_rates')), r);
    }
    await batch.commit();
    console.log("Seeding completed via batch!");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    // Handle Firestore permission errors gracefully
    if (msg.includes('permission-denied') || msg.includes('PERMISSION_DENIED')) {
      console.error("Seed failed: permission-denied — ensure you are Administrator with email_verified");
    } else {
      console.error("Seed batch failed", e);
    }
  }
}
