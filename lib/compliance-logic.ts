import { MaterialReview, COMPLIANCE_STATUSES } from './material-schemas';

export type ComplianceReason = 
  | 'Vendor not approved'
  | 'QC not approved'
  | 'COA missing'
  | 'Material expired'
  | 'Quantity mismatch';

export interface ComplianceResult {
  status: 'Complies' | 'Does Not Comply' | 'Not Applicable';
  reasons: ComplianceReason[];
  isExpired: boolean;
}

/**
 * Auto-calculate compliance status based on review data
 * Marks "Complies" if ALL conditions are met:
 * - Vendor AVL Status = Approved
 * - QC Status = Approved
 * - COA Available = Yes
 * - Material is not expired
 * - Used Quantity <= Issued Quantity
 */
export function calculateCompliance(review: Partial<MaterialReview>): ComplianceResult {
  const reasons: ComplianceReason[] = [];
  let isExpired = false;

  // Check vendor AVL status
  if (review.avlStatus !== 'Approved') {
    reasons.push('Vendor not approved');
  }

  // Check QC status
  if (review.qcStatus !== 'Approved') {
    reasons.push('QC not approved');
  }

  // Check COA availability
  if (review.coaAvailable !== 'Yes') {
    reasons.push('COA missing');
  }

  // Check material expiry
  if (review.expDate) {
    const expiryDate = new Date(review.expDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (expiryDate < today) {
      isExpired = true;
      reasons.push('Material expired');
    }
  }

  // Check quantity mismatch
  if (
    review.usedQuantity !== undefined &&
    review.issuedQuantity !== undefined &&
    review.usedQuantity > review.issuedQuantity
  ) {
    reasons.push('Quantity mismatch');
  }

  // Determine compliance status
  const status: 'Complies' | 'Does Not Comply' | 'Not Applicable' =
    reasons.length === 0 ? 'Complies' : 'Does Not Comply';

  return {
    status,
    reasons,
    isExpired,
  };
}

/**
 * Get human-readable compliance reason descriptions
 */
export function getComplianceReasonDescription(reason: ComplianceReason): string {
  const descriptions: Record<ComplianceReason, string> = {
    'Vendor not approved': 'Vendor AVL Status is not Approved',
    'QC not approved': 'QC Status is not Approved',
    'COA missing': 'Certificate of Analysis is not available',
    'Material expired': 'Material has expired',
    'Quantity mismatch': 'Used Quantity exceeds Issued Quantity',
  };
  return descriptions[reason];
}

/**
 * Check if material is close to expiry (within 30 days)
 */
export function isExpiryWarning(expDate: string): boolean {
  const expiryDate = new Date(expDate);
  const today = new Date();
  const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  return expiryDate <= thirtyDaysFromNow && expiryDate > today;
}

/**
 * Check if retest is due (past retestDate)
 */
export function isRetestDue(retestDate: string | null): boolean {
  if (!retestDate) return false;
  const retest = new Date(retestDate);
  const today = new Date();
  return retest < today;
}

/**
 * Get color class for compliance badge
 */
export function getComplianceBadgeColor(status: string): string {
  switch (status) {
    case 'Complies':
      return 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300';
    case 'Does Not Comply':
      return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300';
    case 'Not Applicable':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Get color class for QC status badge
 */
export function getQCStatusBadgeColor(status: string): string {
  switch (status) {
    case 'Approved':
      return 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300';
    case 'Rejected':
      return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300';
    case 'Under Test':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300';
    case 'Quarantine':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300';
    case 'Retest Required':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Get color class for AVL status badge
 */
export function getAVLStatusBadgeColor(status: string): string {
  switch (status) {
    case 'Approved':
      return 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300';
    case 'Not Approved':
      return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300';
    case 'Conditional Approved':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300';
    case 'Blocked':
      return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}
