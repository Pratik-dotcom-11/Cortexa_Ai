import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

if (typeof window !== 'undefined') {
  testConnection();
}

/**
 * Syncs the authenticated Firebase user's profile and isolated PII document to Firestore
 * adhering strictly to volumetric and schema constraints in firebase-blueprint.json.
 */
export async function syncUserProfileToFirestore(user: {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified?: boolean;
  university?: string;
  major?: string;
}): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== user.uid || !auth.currentUser.emailVerified) {
    return;
  }

  const safeUid = user.uid.slice(0, 128);
  const safeDisplayName = (user.displayName || 'Student').trim().slice(0, 100) || 'Student';
  const safePhotoUrl = (user.photoURL || '').trim().slice(0, 500);
  const safeUniversity = (user.university || '').trim().slice(0, 150);
  const safeMajor = (user.major || '').trim().slice(0, 150);

  const userDocPath = `users/${safeUid}`;
  try {
    const existingSnap = await getDocFromServer(doc(db, 'users', safeUid));
    if (!existingSnap.exists()) {
      await setDoc(doc(db, 'users', safeUid), {
        uid: safeUid,
        displayName: safeDisplayName,
        university: safeUniversity,
        major: safeMajor,
        photoUrl: safePhotoUrl,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const existingData = existingSnap.data();
      await setDoc(doc(db, 'users', safeUid), {
        uid: safeUid,
        displayName: safeDisplayName,
        university: safeUniversity || existingData?.university || '',
        major: safeMajor || existingData?.major || '',
        photoUrl: safePhotoUrl || existingData?.photoUrl || '',
        createdAt: existingData?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userDocPath);
  }

  if (user.email) {
    const safeEmail = user.email.trim().slice(0, 254);
    const privateDocPath = `users/${safeUid}/private/info`;
    try {
      const existingPriv = await getDocFromServer(doc(db, 'users', safeUid, 'private', 'info'));
      if (!existingPriv.exists()) {
        await setDoc(doc(db, 'users', safeUid, 'private', 'info'), {
          uid: safeUid,
          email: safeEmail,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, privateDocPath);
    }
  }
}
