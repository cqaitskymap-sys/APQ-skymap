import { ref, uploadBytes, getDownloadURL, deleteObject, type UploadMetadata } from 'firebase/storage';
import { getFirebaseStorage, isFirebaseConfigured } from './firebase';
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
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
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
  return `/${safeModule}/${safeDocId}/${safeName}`;
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

export async function uploadFile(options: UploadFileOptions): Promise<FileMetadata | null> {
  if (!isFirebaseConfigured()) {
    console.warn('uploadFile skipped: Firebase not configured');
    return null;
  }

  const { moduleName, documentId, file, fileName, uploadedBy, metadataCollection, audit } = options;

  try {
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
    console.error('uploadFile failed:', error);
    throw error;
  }
}

export async function deleteFile(
  moduleName: string,
  documentId: string,
  fileName: string,
): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;

  try {
    const storage = getFirebaseStorage();
    const path = getStoragePath(moduleName, documentId, fileName);
    await deleteObject(ref(storage, path));
    return true;
  } catch (error) {
    console.error('deleteFile failed:', error);
    return false;
  }
}
