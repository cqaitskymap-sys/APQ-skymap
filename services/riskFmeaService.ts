export {
  getRiskFmea,
  listAllFmea,
  fetchFmeaPageData,
  fetchFmeaDashboardData,
  saveFmeaDraft,
  submitFmeaForReview,
  approveFmea,
  rejectFmea,
  closeFmea,
  updateFmeaRow,
  addFmeaRow,
  removeFmeaRow,
  softDeleteFmea,
} from '@/lib/risk-fmea-service';

export type {
  RiskFmeaActor,
  RiskFmeaRecord,
  RiskFmeaHeaderInput,
  FmeaRow,
} from '@/lib/risk-fmea-records';
