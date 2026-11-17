
export const FP_TERMINOLOGY = {
  staffSingular: "Healthcare Worker",
  staffPlural: "Healthcare Workers",
  registration: "Register Healthcare Worker",
  login: "Healthcare Worker Login",
  dashboard: "Healthcare Worker Dashboard",
  approvals: "Healthcare Worker Approvals",
  assignment: "Assign Healthcare Worker",
  pendingApproval: "Healthcare Worker Approval Pending",
  staffManagement: "Healthcare Worker Management",
  clinicalRecord: "Healthcare Worker Clinical Record",
  administeredBy: "Administered by Healthcare Worker",
  stockManagement: "Healthcare Worker Stock Management",
  usageReports: "Healthcare Worker Usage Reports",
} as const;

// Existing internal identifiers remain unchanged.
export const FP_INTERNAL_ROLES = {
  healthcareWorker: "nurse",
  superAdmin: "super_admin",
} as const;
