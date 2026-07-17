'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { normalizeRole } from '@/lib/permissions';
import {
  fetchApprovalDashboard, createApprovalRequest, processApprovalAction,
  bulkApprove, bulkReject,
} from '@/lib/training-approval-service';
import type {
  ApprovalDashboardData, ApprovalFilters, TrainingApprovalActor, ApprovalRequest,
} from '@/lib/training-approval-types';
import {
  canViewTrainingApproval, canApproveTraining, canInitiateTrainingApproval,
  isApprovalReadOnly, roleMatchesApprover, isEmployeeApprovalView,
} from '@/lib/training-approval-types';
import type { CreateApprovalRequestInput } from '@/lib/training-approval-schemas';

export function useTrainingApproval(filters?: ApprovalFilters) {
  const { user, profile } = useAuth();
  const role = normalizeRole(profile?.role);
  const actor: TrainingApprovalActor = useMemo(() => ({
    id: user?.uid || '', name: profile?.full_name || '', role, email: profile?.email,
  }), [user?.uid, profile?.full_name, profile?.email, role]);

  const [data, setData] = useState<ApprovalDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    if (!canViewTrainingApproval(role)) {
      setError('You do not have permission to view training approvals');
      setLoading(false);
      return;
    }
    setRefreshing(true);
    setError(null);
    try {
      const dashboard = await fetchApprovalDashboard(filters);
      if (isEmployeeApprovalView(role)) {
        const own = dashboard.requests.filter((r) => r.initiated_by === actor.id);
        setData({
          ...dashboard,
          requests: own,
          pendingApprovals: own.filter((r) => ['Pending Approval', 'Under Review'].includes(r.current_status)),
          recentDecisions: own.filter((r) => ['Approved', 'Rejected', 'Closed'].includes(r.current_status)).slice(0, 20),
          overdueApprovals: own.filter((r) => ['Pending Approval', 'Under Review'].includes(r.current_status) && r.due_date < new Date().toISOString().slice(0, 10)),
          escalatedRequests: own.filter((r) => r.priority === 'Critical'),
        });
      } else {
        setData(dashboard);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load approvals');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [role, actor, JSON.stringify(filters)]);

  useEffect(() => { refresh(); }, [refresh]);

  const myPending = useMemo(() => {
    if (!data) return [];
    return data.pendingApprovals.filter((r) =>
      roleMatchesApprover(role, r.assigned_approver) || r.initiated_by === actor.id);
  }, [data, role, actor.id]);

  const submitRequest = useCallback(async (input: CreateApprovalRequestInput) => {
    const req = await createApprovalRequest(input, actor);
    await refresh();
    return req;
  }, [actor, refresh]);

  const actOnRequest = useCallback(async (
    requestId: string,
    action: 'Approve' | 'Reject' | 'Return for Revision' | 'Escalate' | 'Cancel',
    comments = '',
    eSignatureId?: string,
    rejectionReason?: string,
  ) => {
    await processApprovalAction({
      request_id: requestId, action, comments,
      e_signature_id: eSignatureId, rejection_reason: rejectionReason,
    }, actor);
    await refresh();
  }, [actor, refresh]);

  const bulkApproveSelected = useCallback(async (eSignatureId?: string) => {
    const count = await bulkApprove(selectedIds, actor, eSignatureId);
    setSelectedIds([]);
    await refresh();
    return count;
  }, [selectedIds, actor, refresh]);

  const bulkRejectSelected = useCallback(async (reason: string) => {
    const count = await bulkReject(selectedIds, actor, reason);
    setSelectedIds([]);
    await refresh();
    return count;
  }, [selectedIds, actor, refresh]);

  return {
    data, loading, refreshing, error, role, actor,
    myPending, selectedIds, setSelectedIds,
    refresh, submitRequest, actOnRequest, bulkApproveSelected, bulkRejectSelected,
    canView: canViewTrainingApproval(role),
    canApprove: canApproveTraining(role),
    canInitiate: canInitiateTrainingApproval(role),
    isReadOnly: isApprovalReadOnly(role),
  };
}

export type { ApprovalRequest, ApprovalDashboardData };
