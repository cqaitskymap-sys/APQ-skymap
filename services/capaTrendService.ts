export * from '@/lib/capa-trend-service';
export {
  canViewCapaTrend,
  canGenerateCapaTrend,
  canReviewCapaTrend,
  canApproveCapaTrend,
  canExportCapaTrend,
  isCapaTrendReadOnly,
  trendStatusColor,
  riskLevelColor,
  CAPA_TREND_MODULE,
  CAPA_TREND_FILTER_OPTIONS,
  CAPA_CLOSURE_TARGET_DAYS,
  capaTrendFilterSchema,
  capaTrendSaveSchema,
} from '@/lib/capa-trend-records';
