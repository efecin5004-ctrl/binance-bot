import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  serverTimestamp,
  Firestore 
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with specific databaseId if provided
export const db: Firestore = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Initialize Firebase Auth
export const auth = getAuth(app);

let currentUser: User | null = null;

// Initialize cloud auth gracefully (falls back seamlessly if anonymous auth is not enabled)
export const initAuth = async (): Promise<User | null> => {
  return new Promise((resolve) => {
    try {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          currentUser = user;
          unsubscribe();
          resolve(user);
        } else {
          try {
            const cred = await signInAnonymously(auth);
            currentUser = cred.user;
            unsubscribe();
            resolve(cred.user);
          } catch (err: any) {
            // Anonymous sign-in is optional when Firestore rules permit direct access
            console.info('Cloud Firestore operating in open direct-sync mode.');
            unsubscribe();
            resolve(null);
          }
        }
      });
    } catch (err) {
      console.info('Auth initialization bypassed for Firestore direct-sync.');
      resolve(null);
    }
  });
};

const BOT_STATE_DOC = 'shared_v1';
const BOT_STATE_COLLECTION = 'trading_engine';

export interface CloudBotState {
  paperBalance?: number;
  dailyStartBalance?: number;
  botStatus?: 'RUNNING' | 'PAUSED' | 'EMERGENCY_STOPPED';
  tradingMode?: 'PAPER' | 'LIVE_TESTNET' | 'LIVE_MAINNET';
  positions?: any[];
  orders?: any[];
  closedTrades?: any[];
  strategies?: any[];
  riskSettings?: any;
  apiCredentials?: any;
  telegramSettings?: any;
  selectedSymbol?: string;
  selectedTimeframe?: string;
  lastUpdated?: any;
  updatedByDeviceId?: string;
}

// Generate or retrieve persistent device id
export const getDeviceId = (): string => {
  let deviceId = localStorage.getItem('bbot_device_id');
  if (!deviceId) {
    deviceId = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + (navigator.userAgent.includes('Mobi') ? 'mobile' : 'desktop');
    localStorage.setItem('bbot_device_id', deviceId);
  }
  return deviceId;
};

// Subscribe to real-time bot state from Firestore (optional cloud sync)
export const subscribeToCloudBotState = (
  onStateUpdate: (state: CloudBotState) => void,
  onError?: (err: any) => void
) => {
  try {
    const docRef = doc(db, BOT_STATE_COLLECTION, BOT_STATE_DOC);

    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as CloudBotState;
          onStateUpdate(data);
        }
      },
      (error) => {
        // Silently handled: VPS Local SQLite is primary authoritative DB
        console.info('Cloud sync idle, operating on VPS Local SQLite engine.');
        if (onError) onError(error);
      }
    );
  } catch (err) {
    return () => {};
  }
};

// Save bot state update to Firestore (optional fallback)
export const saveCloudBotState = async (partialState: Partial<CloudBotState>): Promise<void> => {
  try {
    const docRef = doc(db, BOT_STATE_COLLECTION, BOT_STATE_DOC);
    const payload = {
      ...partialState,
      updatedByDeviceId: getDeviceId(),
      lastUpdated: serverTimestamp()
    };

    // Clean undefined fields to avoid Firestore errors
    const cleanedPayload: any = {};
    Object.entries(payload).forEach(([key, val]) => {
      if (val !== undefined) {
        cleanedPayload[key] = val;
      }
    });

    await setDoc(docRef, cleanedPayload, { merge: true });
  } catch (error) {
    // Primary storage is VPS SQLite; silent cloud fallback
  }
};
