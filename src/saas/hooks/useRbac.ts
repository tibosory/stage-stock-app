import { useMemo } from 'react';
import type { AppRole, Plan } from '../types';
import type { SaaSFeatureFlags } from '../featureFlags';

type Permissions = {
  manageUsers: boolean;
  manageBilling: boolean;
  manageStock: boolean;
  assignProductsToTour: boolean;
  moveProducts: boolean;
  reportIssues: boolean;
  readOnly: boolean;
  useAi: boolean;
};

export function useRbac(
  role: AppRole | null | undefined,
  plan: Plan | null | undefined,
  featureFlags?: Partial<SaaSFeatureFlags> | null
): Permissions {
  return useMemo(() => {
    const r = role ?? 'viewer';
    const p = plan ?? 'free';
    const isAdmin = r === 'admin';
    const isManager = r === 'manager';
    const isTech = r === 'technician';
    const isViewer = r === 'viewer';
    const aiByPlan = p === 'pro' || p === 'enterprise';
    const aiByFlag = featureFlags?.['saas.ai'] ?? true;
    const rbacEnabled = featureFlags?.['saas.rbac'] ?? true;
    const aiAllowed = aiByPlan && aiByFlag;
    return {
      manageUsers: rbacEnabled ? isAdmin : true,
      manageBilling: rbacEnabled ? isAdmin : true,
      manageStock: rbacEnabled ? isAdmin || isManager : true,
      assignProductsToTour: rbacEnabled ? isAdmin || isManager : true,
      moveProducts: rbacEnabled ? isAdmin || isManager || isTech : true,
      reportIssues: rbacEnabled ? isAdmin || isManager || isTech : true,
      readOnly: rbacEnabled ? isViewer : false,
      useAi: aiAllowed,
    };
  }, [featureFlags, plan, role]);
}
