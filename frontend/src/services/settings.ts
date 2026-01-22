import api from './api';

// Use api baseURL; avoid duplicating "/api" prefix
const API_URL = '';

export interface SystemSetting {
    key: string;
    value: string;
    description?: string;
    updated_at: string;
}

export interface IncomeTaxExemptions {
    phd_basic_sciences: number;
    masters_basic_sciences: number;
    phd_other: number;
    masters_other: number;
    bachelors: number;
}

export interface TaxParameters2026 {
    year: number;
    venture_capital_limit: number;
    venture_capital_rate: number;
    venture_capital_max_amount: number;
    remote_work_rate_informatics: number;
    remote_work_rate_other: number;
    income_tax_exemptions: IncomeTaxExemptions;
    corporate_tax_rate: number;
    vat_rate: number;
    daily_food_exemption: number;
    daily_transport_exemption: number;
    sgk_employer_share_discount: number;
    stamp_tax_exemption_rate: number;
}

export interface TaxParametersUpdate {
    venture_capital_limit?: number;
    venture_capital_rate?: number;
    venture_capital_max_amount?: number;
    remote_work_rate_informatics?: number;
    remote_work_rate_other?: number;
    income_tax_exemptions?: Partial<IncomeTaxExemptions>;
    corporate_tax_rate?: number;
    vat_rate?: number;
    daily_food_exemption?: number;
    daily_transport_exemption?: number;
    sgk_employer_share_discount?: number;
    stamp_tax_exemption_rate?: number;
}

export interface YearlyTaxSummary {
    year: number;
    total_exempt_income: number;
    total_rd_expense: number;
    total_corporate_tax_exemption: number;
    total_vat_exemption: number;
    total_personnel_incentive: number;
    total_venture_capital_obligation: number;
    total_tax_advantage: number;
}

export const settingsService = {
    getAll: async () => {
        const response = await api.get<SystemSetting[]>(`${API_URL}/settings/`);
        return response.data;
    },

    get: async (key: string) => {
        const response = await api.get<SystemSetting>(`${API_URL}/settings/${key}`);
        return response.data;
    },

    update: async (key: string, value: string, description?: string) => {
        const response = await api.put<SystemSetting>(`${API_URL}/settings/${key}/`, {
            value,
            description,
        });
        return response.data;
    },

    getCompanyInfo: async () => {
        const response = await api.get(`${API_URL}/settings/company`);
        return response.data;
    },

    updateCompanyInfo: async (data: any) => {
        const response = await api.post(`${API_URL}/settings/company`, data);
        return response.data;
    },

    // Tax Parameters API
    getTaxParameters: async (year: number = 2026) => {
        const response = await api.get<TaxParameters2026>(`${API_URL}/settings/tax-parameters?year=${year}`);
        return response.data;
    },

    updateTaxParameters: async (updates: TaxParametersUpdate, year: number = 2026) => {
        const response = await api.patch<TaxParameters2026>(`${API_URL}/settings/tax-parameters?year=${year}`, updates);
        return response.data;
    },

    calculateMonthlyTax: async (year: number, month: number) => {
        const response = await api.get(`${API_URL}/settings/tax-parameters/calculate?year=${year}&month=${month}`);
        return response.data;
    },

    getYearlyTaxSummary: async (year: number = 2026) => {
        const response = await api.get<YearlyTaxSummary>(`${API_URL}/settings/tax-parameters/yearly-summary?year=${year}`);
        return response.data;
    },

    // PDF Report Generation
    generateMonthlyExemptionReport: async (year: number, month: number) => {
        const response = await api.get(`${API_URL}/exemption-reports/generate-pdf?year=${year}&month=${month}`, {
            responseType: 'blob'
        });
        return response.data;
    }
};
