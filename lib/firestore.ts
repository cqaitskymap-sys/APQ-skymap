export { firestore, storage, isFirebaseConfigured } from './firebase';
export {
  createRecord,
  getRecord,
  getRecords,
  updateRecord,
  deleteRecord,
  recordExists,
} from './firestore-service';

export const timestampNow = () => new Date().toISOString();
