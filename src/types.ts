export enum UserRole {
  SUPER_ADMIN = "super_admin",
  ADMIN = "admin",
  QA_MANAGER = "qa_manager",
  QA_AUDITOR = "qa_auditor",
  TEAM_LEADER = "team_leader",
  AGENT = "agent",
  CLIENT = "client"
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  employeeId?: string;
  team?: string;
  lob?: string;
  avatarUrl?: string;
  status: "active" | "inactive";
  lastLogin?: string;
  createdAt: string;
}

export interface AuthSession {
  user: User | null;
  token: string | null;
  expiresAt: number | null;
  rememberMe: boolean;
}

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info" | "warning";
  title: string;
  description?: string;
}

export interface ImportProfile {
  id: string;
  name: string;
  mandatoryMapping: Record<string, string>;
  optionalMapping: Record<string, { mode: "ignore" | "metadata" | "assignment", target?: string }>;
  qaFormConfig: QAField[];
  assignmentRules?: AssignmentRule;
  createdAt: string;
}

export interface QAField {
  id: string;
  name: string;
  description?: string;
  mandatory: boolean;
  critical: boolean;
  weight: number;
  orderIndex: number;
  type: QAFieldType;
  options?: string[]; // For dropdown/multi-select
  formula?: string;
  formulaOutputType?: "text" | "number" | "percentage" | "date" | "boolean";
}

export type QAFieldType = 
  | "text" 
  | "long_text" 
  | "number" 
  | "percentage" 
  | "date" 
  | "yes_no" 
  | "checkbox" 
  | "dropdown" 
  | "multi_select" 
  | "rating_5" 
  | "rating_10" 
  | "url" 
  | "attachment"
  | "formula";

export interface AssignmentRule {
  mode: "random" | "header_based";
  distributionMode: "random" | "round_robin" | "balanced";
  headerColumn?: string;
  mappings?: Record<string, string[]>; // Value -> Auditor IDs
  auditorIds?: string[];
}

export interface ImportBatchSummary {
  total: number;
  imported: number;
  skipped: number;
  failed: number;
  duplicates: number;
  batchId: string;
  durationMs: number;
}
