import { ref, uploadBytes, getDownloadURL, deleteObject, type UploadMetadata } from 'firebase/storage';
import { getFirebaseAuth, getFirebaseStorage, isFirebaseConfigured } from './firebase';
import { getFirebaseStorageBucket } from './firebase-config';
import { updateDocument, type DocumentAuditContext } from './firestore';

export { isFirebaseConfigured } from './firebase';

export const ALLOWED_FILE_TYPES = {
  pdf: ['application/pdf'],
  excel: [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  word: [
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  image: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
} as const;

export type FileCategory = keyof typeof ALLOWED_FILE_TYPES;

export interface FileMetadata {
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedBy: string;
  uploadedAt: string;
}

export interface UploadFileOptions {
  moduleName: string;
  documentId: string;
  file: File | Blob;
  fileName: string;
  uploadedBy: string;
  /** Firestore collection to attach metadata (optional) */
  metadataCollection?: string;
  audit?: DocumentAuditContext;
}

function nowIso() {
  return new Date().toISOString();
}

function getStoragePath(moduleName: string, documentId: string, fileName: string): string {
  const safeModule = moduleName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeDocId = documentId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `/${safeModule}/${safeDocId}/${safeName}`.replace(/^\/+/, '');
}

export function getFileCategory(mimeType: string): FileCategory | null {
  for (const [category, types] of Object.entries(ALLOWED_FILE_TYPES)) {
    if ((types as readonly string[]).includes(mimeType)) {
      return category as FileCategory;
    }
  }
  return null;
}

export function isAllowedFileType(mimeType: string): boolean {
  return getFileCategory(mimeType) !== null;
}

const STORAGE_SETUP_HINT =
  'Enable Firebase Storage in the Firebase Console (Build → Storage → Get started), confirm NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET matches the bucket name shown there, then run: npm run deploy:storage';

export function formatStorageError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  const message = error instanceof Error ? error.message : String(error);
  const serverResponse = (error as { customData?: { serverResponse?: string } })?.customData?.serverResponse ?? '';

  if (code === 'storage/unauthorized' || code === 'storage/unauthenticated') {
    return 'You must be signed in to upload files. Sign out and sign in again, then retry.';
  }
  if (message.includes('permission') || message.includes('403')) {
    return `Upload denied by storage rules. ${STORAGE_SETUP_HINT}`;
  }
  if (
    code === 'storage/unknown'
    || code === 'storage/bucket-not-found'
    || message.includes('404')
    || serverResponse.includes('404')
    || message.toLowerCase().includes('cors')
    || message.toLowerCase().includes('preflight')
  ) {
    return `Firebase Storage bucket is not reachable (often Storage is not enabled yet). ${STORAGE_SETUP_HINT}`;
  }
  if (code === 'storage/canceled') {
    return 'Upload was canceled.';
  }
  if (code === 'storage/quota-exceeded') {
    return 'Storage quota exceeded.';
  }
  if (message) return message;
  return 'File upload failed.';
}

async function ensureStorageAuth(): Promise<void> {
  const authUser = getFirebaseAuth().currentUser;
  if (!authUser) {
    throw new Error('You must be signed in to upload files.');
  }
  await authUser.getIdToken(true);
}

export async function uploadFile(options: UploadFileOptions): Promise<FileMetadata | null> {
  if (!isFirebaseConfigured()) {
    console.warn('uploadFile skipped: Firebase not configured');
    return null;
  }

  const { moduleName, documentId, file, fileName, uploadedBy, metadataCollection, audit } = options;

  try {
    await ensureStorageAuth();
    const storage = getFirebaseStorage();
    const path = getStoragePath(moduleName, documentId, fileName);
    const storageRef = ref(storage, path);

    const mimeType = file instanceof File ? file.type : 'application/octet-stream';
    if (!isAllowedFileType(mimeType)) {
      throw new Error(`File type not allowed: ${mimeType}. Allowed: PDF, Excel, Word, Images.`);
    }

    const metadata: UploadMetadata = {
      contentType: mimeType,
      customMetadata: {
        moduleName,
        documentId,
        uploadedBy,
      },
    };

    await uploadBytes(storageRef, file, metadata);
    const fileUrl = await getDownloadURL(storageRef);

    const fileMeta: FileMetadata = {
      fileName,
      fileUrl,
      fileType: mimeType,
      fileSize: file.size,
      uploadedBy,
      uploadedAt: nowIso(),
    };

    if (metadataCollection) {
      await updateDocument(
        metadataCollection,
        documentId,
        { attachments: fileMeta },
        audit,
      );
    }

    return fileMeta;
  } catch (error) {
    const formatted = formatStorageError(error);
    console.error('uploadFile failed:', formatted, error);
    throw new Error(formatted);
  }
}

export async function deleteFile(
  moduleName: string,
  documentId: string,
  fileName: string,
): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;

  try {
    await ensureStorageAuth();
    const storage = getFirebaseStorage();
    const path = getStoragePath(moduleName, documentId, fileName);
    await deleteObject(ref(storage, path));
    return true;
  } catch (error) {
    console.error('deleteFile failed:', error);
    return false;
  }
}
