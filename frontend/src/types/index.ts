// Base Types
export interface BaseEntity {
  id: number;
  created_at?: string;
  updated_at?: string;
}

// Workflow Types
export interface Workflow extends BaseEntity {
  name: string;
  version: number;
  description?: string;
  bpmn_xml?: string;
}

export interface Activity extends BaseEntity {
  workflow_definition_id: number;
  name: string;
  activity_type: 'manual' | 'automatic' | 'user' | 'service';
  description?: string;
  configuration?: string;
}

export interface Transition extends BaseEntity {
  from_activity_id: number;
  to_activity_id: number;
  condition_expression?: string;
  name?: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
}

export interface WorkflowDetail {
  workflow: Workflow;
  activities: Activity[];
  transitions: Transition[];
}

// Form Data Types
export interface WorkflowFormData {
  name: string;
  description?: string;
  version?: number;
}

export interface ActivityFormData {
  name: string;
  activity_type: Activity['activity_type'];
  description?: string;
  configuration?: string;
}

export interface TransitionFormData {
  from_activity_id: number;
  to_activity_id: number;
  condition_expression?: string;
  name?: string;
}

// Toast Types
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

// Theme Types
export type ThemeMode = 'light' | 'dark' | 'auto';

export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  success: string;
  warning: string;
  error: string;
  info: string;
}

export interface Theme {
  mode: ThemeMode;
  colors: ThemeColors;
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  typography: {
    fontFamily: string;
    fontSize: {
      xs: string;
      sm: string;
      base: string;
      lg: string;
      xl: string;
      '2xl': string;
    };
  };
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
  };
}

// Hook Return Types
export interface UseWorkflowsResult {
  workflows: Workflow[];
  loading: boolean;
  error: string | null;
  createWorkflow: (data: WorkflowFormData) => Promise<{ success: boolean; data?: Workflow; error?: string }>;
  updateWorkflow: (id: number, data: WorkflowFormData) => Promise<{ success: boolean; data?: Workflow; error?: string }>;
  deleteWorkflow: (id: number) => Promise<{ success: boolean; error?: string }>;
  loadWorkflows: () => void;
  createDemoWorkflow: () => Promise<{ success: boolean; data?: Workflow; error?: string }>;
}

export interface UseWorkflowDetailResult {
  workflowDetail: Workflow | null;
  activities: Activity[];
  transitions: Transition[];
  loading: boolean;
  error: string | null;
  createActivity: (data: ActivityFormData) => Promise<{ success: boolean; data?: Activity; error?: string }>;
  updateActivity: (id: number, data: ActivityFormData) => Promise<{ success: boolean; data?: Activity; error?: string }>;
  deleteActivity: (id: number) => Promise<{ success: boolean; error?: string }>;
  createTransition: (data: TransitionFormData) => Promise<{ success: boolean; data?: Transition; error?: string }>;
  updateTransition: (id: number, data: TransitionFormData) => Promise<{ success: boolean; data?: Transition; error?: string }>;
  deleteTransition: (id: number) => Promise<{ success: boolean; error?: string }>;
}

// Component Props Types
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'default' | 'danger' | 'warning';
}

export interface ProgressBarProps {
  value: number;
  max?: number;
  className?: string;
  showText?: boolean;
  size?: 'small' | 'medium' | 'large';
  variant?: 'primary' | 'success' | 'warning' | 'danger';
  animated?: boolean;
  striped?: boolean;
}