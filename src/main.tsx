import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import './styles/globals.css';
import { App } from './App';

const showError = (error: Error) => toast.error(error.message);
const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: showError }),
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 }, mutations: { retry: false } },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><QueryClientProvider client={queryClient}><App /></QueryClientProvider></React.StrictMode>,
);
