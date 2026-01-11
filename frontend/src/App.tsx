import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import Layout from '@/components/Layout';
import Dashboard from '@/views/Dashboard';
import AccountList from '@/views/AccountList';
import AccountLedger from '@/views/AccountLedger';
import ProductList from '@/views/ProductList';
import Deals from '@/views/Deals';
import QuoteList from '@/views/QuoteList';
import QuoteBuilder from '@/views/QuoteBuilder';
import InvoiceList from '@/views/InvoiceList';
import InvoiceBuilder from '@/views/InvoiceBuilder';
import InvoiceUploader from '@/views/InvoiceUploader';
import Financials from '@/views/Financials';
import Projects from '@/views/Projects';
import FinancialAccounts from '@/views/FinancialAccounts';
import Login from '@/views/Login';

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
            <Route path="/accounts/:accountId/ledger" element={<AccountLedger />} />
            <Route path="/products" element={<ProductList />} />
            <Route path="/deals" element={<Deals />} />
            <Route path="/quotes" element={<QuoteList />} />
            <Route path="/quotes/new" element={<QuoteBuilder />} />
            <Route path="/invoices" element={<InvoiceList />} />
            <Route path="/invoices/new" element={<InvoiceBuilder />} />
            <Route path="/invoices/upload" element={<InvoiceUploader />} />
            <Route path="/finance" element={<Financials />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/financial-accounts" element={<FinancialAccounts />} />
          </Route>
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
