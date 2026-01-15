import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';
import Layout from '@/components/Layout';
import Dashboard from '@/views/Dashboard';
import AccountList from '@/views/AccountList';

import AccountDetail from '@/views/AccountDetail';
import AccountLedger from '@/views/AccountLedger';
import ProductList from '@/views/ProductList';
import Deals from '@/views/Deals';
import QuoteList from '@/views/QuoteList';
import QuoteBuilder from '@/views/QuoteBuilder';
import InvoiceList from '@/views/InvoiceList';
import InvoiceBuilder from '@/views/InvoiceBuilder';
import InvoiceUploader from '@/views/InvoiceUploader';
import SalesInvoices from '@/views/SalesInvoices';
import Expenses from '@/views/Expenses';
import Financials from '@/views/Financials';
import Projects from '@/views/Projects';
import FinancialAccounts from '@/views/FinancialAccounts';
import Login from '@/views/Login';
import EArsiv from '@/views/EArsiv';
import Settings from '@/views/Settings';
import ProjectDetail from '@/views/ProjectDetail';
import CsvImport from '@/views/CsvImport';
import Contacts from '@/views/Contacts';
import ContactDetail from '@/views/ContactDetail';

const queryClient = new QueryClient();

function AppLayout() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/customers" element={<AccountList />} />

            <Route path="/accounts/:accountId" element={<AccountDetail />} />
            <Route path="/accounts/:accountId/ledger" element={<AccountLedger />} />
            <Route path="/products" element={<ProductList />} />
            <Route path="/deals" element={<Deals />} />
            <Route path="/quotes" element={<QuoteList />} />
            <Route path="/quotes/new" element={<QuoteBuilder />} />
            {/* New Sales/Expense separated views */}
            <Route path="/sales-invoices" element={<SalesInvoices />} />
            <Route path="/expenses" element={<Expenses />} />
            {/* Legacy routes - kept for compatibility */}
            <Route path="/invoices" element={<InvoiceList />} />
            <Route path="/invoices/new" element={<InvoiceBuilder />} />
            <Route path="/invoices/upload" element={<InvoiceUploader />} />
            <Route path="/finance" element={<Financials />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/financial-accounts" element={<FinancialAccounts />} />
            <Route path="/earsiv" element={<EArsiv />} />
            <Route path="/csv-import" element={<CsvImport />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/contacts/:contactId" element={<ContactDetail />} />
          </Route>
        </Routes>
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
