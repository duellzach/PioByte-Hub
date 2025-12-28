
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  setDoc, 
  doc, 
  deleteDoc, 
  query, 
  orderBy
} from "firebase/firestore";

/**
 * FIREBASE CONFIGURATION
 * Replace the values below with the ones from your Firebase Console.
 */
const firebaseConfig = {
  apiKey: "REPLACE_WITH_YOUR_API_KEY",
  authDomain: "REPLACE_WITH_YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "REPLACE_WITH_YOUR_PROJECT_ID",
  storageBucket: "REPLACE_WITH_YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "REPLACE_WITH_SENDER_ID",
  appId: "REPLACE_WITH_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Collection References
export const usersCol = collection(db, "users");
export const projectsCol = collection(db, "projects");
export const tasksCol = collection(db, "tasks");
export const notificationsCol = collection(db, "notifications");
export const announcementsCol = collection(db, "announcements");

// Helper to convert Firestore snapshots to local state
export const syncCollection = (colRef: any, callback: (data: any[]) => void, sortField?: string) => {
  const q = sortField ? query(colRef, orderBy(sortField, 'desc')) : colRef;
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    }));
    callback(data);
  }, (error) => {
    console.error(`Firebase Sync Error on ${colRef.path}:`, error);
  });
};

// Generic DB Operations
export const saveDoc = async (colName: string, data: any) => {
  if (!data.id) {
      console.error("Cannot save document without an ID");
      return;
  }
  const docRef = doc(db, colName, data.id);
  await setDoc(docRef, data, { merge: true });
};

export const removeDoc = async (colName: string, id: string) => {
  await deleteDoc(doc(db, colName, id));
};
