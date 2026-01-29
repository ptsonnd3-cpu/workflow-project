import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Create a client with optimized settings
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 5 minutes
      staleTime: 5 * 60 * 1000, // 5 minutes
      // Keep data in cache for 10 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      // Retry failed requests 2 times
      retry: 2,
      // Don't refetch on window focus in development
      refetchOnWindowFocus: process.env.NODE_ENV === 'production',
      // Refetch on reconnect
      refetchOnReconnect: true,
      // Background refetch interval (30 minutes)
      refetchInterval: 30 * 60 * 1000,
    },
    mutations: {
      retry: 1,
    },
  },
});

// Query Client Provider component
export function QueryProvider({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}

// Query keys for better organization
export const queryKeys = {
  workflows: ['workflows'],
  workflow: (id) => ['workflow', id],
  workflowDetail: (id) => ['workflow', id, 'detail'],
  activities: (workflowId) => ['workflow', workflowId, 'activities'],
  transitions: (workflowId) => ['workflow', workflowId, 'transitions'],
  outbox: (status) => ['outbox', { status }],
};

// Prefetch utilities
export const prefetchUtils = {
  async prefetchWorkflows() {
    const { workflowService } = await import('../services/workflowService');
    await queryClient.prefetchQuery({
      queryKey: queryKeys.workflows,
      queryFn: workflowService.getAll,
    });
  },

  async prefetchWorkflowDetail(id) {
    const { workflowService } = await import('../services/workflowService');
    await queryClient.prefetchQuery({
      queryKey: queryKeys.workflowDetail(id),
      queryFn: () => workflowService.getFullDetails(id),
    });
  },
};