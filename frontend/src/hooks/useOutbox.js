import { useState, useCallback, useEffect } from 'react';
import { outboxService } from '../services/dataService';

export function useOutbox(isActive) {
  const [outbox, setOutbox] = useState([]);
  const [outboxStatus, setOutboxStatus] = useState('PENDING');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadOutbox = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const data = await outboxService.getAll(outboxStatus);
      setOutbox(data);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [outboxStatus]);

  const retryOutbox = useCallback(async (id) => {
    setError('');
    setLoading(true);
    try {
      await outboxService.retry(id);
      await loadOutbox();
      return { success: true };
    } catch (e) {
      setError(e.message || String(e));
      return { success: false, error: e.message || String(e) };
    } finally {
      setLoading(false);
    }
  }, [loadOutbox]);

  // Auto-load when active or status changes
  useEffect(() => {
    if (isActive) {
      loadOutbox();
    }
  }, [isActive, loadOutbox]);

  return {
    outbox,
    outboxStatus,
    setOutboxStatus,
    loading,
    error,
    setError,
    loadOutbox,
    retryOutbox
  };
}