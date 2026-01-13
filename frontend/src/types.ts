export interface Deal {
    id: number;
    title: string;
    status: string;
    estimated_value: number;
    customer_id: number;
    source?: string;
    probability?: number;
    account?: {
        id: number;
        title: string;
    };
    created_at?: string;
}

export interface Account {
    id: number;
    title: string;
    account_type: string;
}
