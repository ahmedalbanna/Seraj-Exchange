export type UserRole = 'Administrator' | 'Supervisor' | 'Teller';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  branchId?: string;
}

export interface Currency {
  id?: string;
  code: string;
  name: string;
  symbol: string;
  isActive: boolean;
}

export interface ExchangeRate {
  id?: string;
  baseCurrency: string;
  targetCurrency: string;
  officialRate: number;
  marketRate: number;
  date: any; // Firestore Timestamp
  updatedBy: string;
}

export type TransferStatus = 'pending' | 'processing' | 'received' | 'failed' | 'cancelled';

export interface Transfer {
  id?: string;
  senderName: string;
  senderPhone: string;
  receiverName: string;
  receiverPhone: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  totalAmount: number;
  fromBranchId: string;
  toBranchId: string;
  status: TransferStatus;
  issuedAt: any; // Firestore Timestamp
  issuedBy: string;
  expectedReceiptDate?: any;
  receivedAt?: any;
  receivedBy?: string;
  notes?: string;
}

export interface Settlement {
  id?: string;
  fromBranchId: string;
  toBranchId: string;
  currency: string;
  amount: number;
  appliedRate: number;
  settledAmount: number;
  settledAt: any;
  settledBy: string;
  transferIds: string[]; // List of transfers covered by this settlement
  status: 'pending' | 'completed';
}

export interface Branch {
  id?: string;
  name: string;
  location: string;
  managerId?: string;
  balances?: Record<string, number>;
}

export interface Notification {
  id?: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: any;
  link?: string;
}
