import { apiGet, apiPost, apiPut, apiDelete } from './apiClient';

export const workflowService = {
  // Workflow CRUD
  async getAll() {
    return apiGet('/api/workflows');
  },

  async getById(id) {
    return apiGet(`/api/workflows/${id}`);
  },

  async getFullDetails(id) {
    const [wfData, actsData, transData] = await Promise.all([
      apiGet(`/api/workflows/${id}`),
      apiGet(`/api/workflows/${id}/activities`),
      apiGet(`/api/workflows/${id}/transitions`)
    ]);
    return {
      workflow: wfData.workflow,
      activities: actsData,
      transitions: transData
    };
  },

  async create(data) {
    return apiPost('/api/workflows', data);
  },

  async update(id, data) {
    return apiPut(`/api/workflows/${id}`, data);
  },

  async delete(id) {
    return apiDelete(`/api/workflows/${id}`);
  },

  // BPMN operations
  async saveBpmnXml(id, bpmnXml) {
    return apiPost(`/api/workflows/${id}/save-bpmn-xml`, { bpmnXml });
  },

  async exportBpmn(id) {
    return apiGet(`/api/workflows/${id}/export-bpmn`);
  },

  // Demo workflows
  async createApprovalWorkflow(data) {
    return apiPost('/api/demo/create-approval-workflow', data);
  },

  async createAdvancedApprovalWorkflow(data) {
    return apiPost('/api/demo/create-advanced-approval-workflow', data);
  },

  async createDemo() {
    return apiPost('/api/demo/create-approval-workflow', {});
  },

  // Activity CRUD
  async createActivity(workflowId, data) {
    return apiPost(`/api/workflows/${workflowId}/activities`, data);
  },

  async updateActivity(id, data) {
    return apiPut(`/api/activities/${id}`, data);
  },

  async deleteActivity(id) {
    return apiDelete(`/api/activities/${id}`);
  },

  // Transition CRUD  
  async createTransition(workflowId, data) {
    return apiPost(`/api/workflows/${workflowId}/transitions`, data);
  },

  async updateTransition(id, data) {
    return apiPut(`/api/transitions/${id}`, data);
  },

  async deleteTransition(id) {
    return apiDelete(`/api/transitions/${id}`);
  },

  // Outbox
  async getOutbox() {
    return apiGet('/api/outbox');
  },

  // BPMN Import
  async importBPMN(data) {
    return apiPost('/api/workflows/import-bpmn', data);
  }
};