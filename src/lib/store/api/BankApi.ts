import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const BASE_URL = '/api/';

export type SupportedBank = 'abank' | 'vbank' | 'sbank';

export interface ConnectBankRequest {
  client_id: string;
}

export interface ConnectBankResponse {
  message: string;
  success: boolean;
}

export interface SupportedBanksResponse {
  banks: SupportedBank[];
}

export interface BankOverviewParams {
  includeTransactions?: boolean;
  transactionsLimit?: number;
  refresh?: boolean;
}

export interface Transaction {
  id: string | number;
  amount: number;
  type: 'income' | 'expense';
  description?: string;
  category?: string;
  date: string;
  accountId?: string | number;
}

export interface Account {
  id: string | number;
  bankId: SupportedBank;
  accountNumber?: string;
  balance: number;
  currency: string;
  type?: string;
  transactions?: Transaction[];
}

export interface BankInfo {
  id: SupportedBank;
  name: string;
  accounts: Account[];
  totalBalance?: number;
}

export interface BankOverviewResponse {
  banks: BankInfo[];
  totalBalance?: number;
  lastSync?: string;
}

// We rely on secure HTTP-only cookies; no JS access to token

export const bankApi = createApi({
  reducerPath: 'bankApi',
  baseQuery: fetchBaseQuery({
    baseUrl: BASE_URL,
    credentials: 'include',
  }),
  tagTypes: ['Bank'],
  endpoints: (builder) => ({
    // Returns: { "banks": ["vbank", "sbank", "abank"] }
    getSupportedBanks: builder.query<SupportedBanksResponse, void>({
      query: () => 'bank/supported/list',
      providesTags: ['Bank'],
    }),
    // Get bank overview: GET /bank/overview
    // Query params: includeTransactions (true/false, default: true)
    //               transactionsLimit (1-200, default: 20, only if includeTransactions=true)
    //               refresh (true/false, default: false)
    getBankOverview: builder.query<BankOverviewResponse, BankOverviewParams | void>({
      query: (params) => {
        const searchParams = new URLSearchParams();
        
        if (params) {
          if (params.includeTransactions !== undefined) {
            searchParams.append('includeTransactions', params.includeTransactions ? 'true' : 'false');
          }
          if (params.transactionsLimit !== undefined && params.includeTransactions !== false) {
            // Only add transactionsLimit if includeTransactions is true or not specified
            const limit = Math.max(1, Math.min(200, params.transactionsLimit));
            searchParams.append('transactionsLimit', limit.toString());
          }
          if (params.refresh !== undefined) {
            searchParams.append('refresh', params.refresh ? 'true' : 'false');
          }
        }
        
        const queryString = searchParams.toString();
        return `bank/overview${queryString ? `?${queryString}` : ''}`;
      },
      providesTags: ['Bank'],
    }),
    // Connect bank: POST /connection/connect/:bankId
    connectBank: builder.mutation<ConnectBankResponse, { bankId: SupportedBank; client_id: string }>({
      query: ({ bankId, client_id }) => ({
        url: `connection/connect/${bankId}`,
        method: 'POST',
        body: { client_id },
      }),
      invalidatesTags: ['Bank'],
    }),
  }),
});

export const {
  useGetSupportedBanksQuery,
  useGetBankOverviewQuery,
  useConnectBankMutation,
} = bankApi;

