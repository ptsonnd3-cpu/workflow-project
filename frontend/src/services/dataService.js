import { apiGet, apiPost, apiPut, apiDelete } from './apiClient';

export const activityService = {
  async getByWorkflowId(workflowId) {
    return apiGet(`/api/workflows/${workflowId}/activities`);
  },

  async create(workflowId, data) {
    return apiPost(`/api/workflows/${workflowId}/activities`, data);
  },

  async update(id, data) {
    return apiPut(`/api/activities/${id}`, data);
  },

  async delete(id) {
    return apiDelete(`/api/activities/${id}`);
  }
};

export const transitionService = {
  async getByWorkflowId(workflowId) {
    return apiGet(`/api/workflows/${workflowId}/transitions`);
  },

  async create(workflowId, data) {
    return apiPost(`/api/workflows/${workflowId}/transitions`, data);
  },

  async update(id, data) {
    return apiPut(`/api/transitions/${id}`, data);
  },

  async delete(id) {
    return apiDelete(`/api/transitions/${id}`);
  }
};

export const outboxService = {
  async getAll(status = '') {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return apiGet(`/api/outbox${query}`);
  },

  async retry(id) {
    return apiPost(`/api/outbox/${id}/retry`);
  }
};