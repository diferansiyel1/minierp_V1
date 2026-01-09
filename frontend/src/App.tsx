import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import Dashboard from '@/views/Dashboard';
import AccountList from '@/views/AccountList';
import AccountLedger from '@/views/AccountLedger';
import ProductList from '@/views/ProductList';
import Deals from '@/views/Deals';
import QuoteList from '@/views/QuoteList';
import QuoteBuilder from '@/views/QuoteBuilder';
import InvoiceBuilder from '@/views/InvoiceBuilder';
import Financials from '@/views/Financials';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/customers" element={<AccountList />} />
            <Route path="/accounts/:accountId/ledger" element={<AccountLedger />} />
            <Route path="/products" element={<ProductList />} />
            <Route path="/deals" element={<Deals />} />
            <Route path="/quotes" element={<QuoteList />} />
            <Route path="/quotes/new" element={<QuoteBuilder />} />
            <Route path="/invoices" element={<InvoiceBuilder />} />
            <Route path="/finance" element={<Financials />} />
          </Routes>
        </Layout>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
