import api from './api';

export type PersonnelType =
  | 'RD_PERSONNEL'
  | 'SUPPORT_PERSONNEL'
  | 'INTERN'
  | 'SOFTWARE_PERSONNEL';
export type PayrollEducationLevel = 'HIGH_SCHOOL' | 'ASSOCIATE' | 'BACHELOR' | 'MASTER' | 'PHD';
export type GraduationField = 'ENGINEERING' | 'BASIC_SCIENCES' | 'OTHER';

export interface EmployeePayload {
  full_name: string;
  tc_id_no: string;
  email?: string | null;
  is_active: boolean;
  start_date?: string | null;
  end_date?: string | null;
  project_id?: number | null;
  personnel_type: PersonnelType;
  education_level: PayrollEducationLevel;
  graduation_field: GraduationField;
  is_student: boolean;
  gross_salary: number;
}

export interface Employee extends EmployeePayload {
  id: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PayrollPeriodPayload {
  year: number;
  month: number;
  is_locked?: boolean;
}

export interface PayrollPeriod extends PayrollPeriodPayload {
  id: number;
  created_at?: string | null;
}

export interface PayrollEntryInput {
  employee_id: number;
  worked_days: number;
  remote_days: number;
  weekend_days: number;
  absent_days: number;
  tgb_inside_minutes: number;
  tgb_outside_minutes: number;
  annual_leave_minutes: number;
  official_holiday_minutes: number;
  cb_outside_minutes: number;
  total_minutes: number;
}

export interface PayrollEntry extends PayrollEntryInput {
  id: number;
  payroll_period_id: number;
  calculated_gross: number;
  sgk_base: number;
  income_tax_base: number;
  net_salary: number;
  income_tax_exemption_amount: number;
  stamp_tax_exemption_amount: number;
  sgk_employer_incentive_amount: number;
}

export interface PayrollSummary {
  total_personnel_cost: number;
  total_incentive: number;
  payable_sgk: number;
  total_income_tax_exemption: number;
  total_stamp_tax_exemption: number;
}

export const payrollService = {
  listEmployees: async (activeOnly: boolean = true) => {
    const response = await api.get<Employee[]>(`/payroll/employees?active_only=${activeOnly}`);
    return response.data;
  },

  createEmployee: async (payload: EmployeePayload) => {
    const response = await api.post<Employee>('/payroll/employees', payload);
    return response.data;
  },

  updateEmployee: async (employeeId: number, payload: Partial<EmployeePayload>) => {
    const response = await api.put<Employee>(`/payroll/employees/${employeeId}`, payload);
    return response.data;
  },

  listPeriods: async () => {
    const response = await api.get<PayrollPeriod[]>('/payroll/periods');
    return response.data;
  },

  createPeriod: async (payload: PayrollPeriodPayload) => {
    const response = await api.post<PayrollPeriod>('/payroll/periods', payload);
    return response.data;
  },

  listEntries: async (periodId: number) => {
    const response = await api.get<PayrollEntry[]>(`/payroll/periods/${periodId}/entries`);
    return response.data;
  },

  processPeriod: async (periodId: number, entries: PayrollEntryInput[]) => {
    const response = await api.post<PayrollEntry[]>(`/payroll/periods/${periodId}/process`, { entries });
    return response.data;
  },

  getSummary: async (periodId: number) => {
    const response = await api.get<PayrollSummary>(`/payroll/periods/${periodId}/summary`);
    return response.data;
  },

  downloadPersonnelReport: async (periodId: number) => {
    const response = await api.get(`/payroll/periods/${periodId}/technopark-personnel-report`, {
      responseType: 'blob',
    });
    return response.data as Blob;
  },
};
