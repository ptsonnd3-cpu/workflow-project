// Load environment variables
require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { db, testConnection } = require('./database');
const { XMLParser } = require('fast-xml-parser');
const expressValidator = require('express-validator');
const { body, param } = expressValidator;

// Import validation middleware
const {
  setupSecurity,
  handleValidationErrors,
  workflowValidation,
  activityValidation,
  transitionValidation,
  bpmnValidation,
  idParamValidation,
  outboxQueryValidation
} = require('./middleware/validation');

const app = express();

// MINIMAL DEBUG SETUP - Disable all complex middleware
app.get('/api/simple-test', (req, res) => {
  console.log('[SIMPLE TEST] Endpoint hit');
  res.json({ message: 'Simple test works', timestamp: Date.now() });
});

// Setup security middleware - DISABLED FOR DEBUGGING
// setupSecurity(app);

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' })); // Increase limit for BPMN XML

// Debug middleware
app.use((req, res, next) => {
  console.log('[MIDDLEWARE] Request:', req.method, req.url);
  
  // Disable cache for API routes
  if (req.url.startsWith('/api/')) {
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
  }
  
  next();
});

// DEBUG: Test endpoint
app.get('/api/debug-test', (req, res) => {
  console.log('[DEBUG] Debug endpoint hit');
  res.json({ message: 'Debug endpoint works' });
});

// --- BPMN Migration Helper ---
const createBPMNWithDiagram = (processName = 'Process') => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" 
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" 
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" 
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI" 
                  id="Definitions_${Date.now()}" 
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_${Date.now()}" name="${processName}" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1" name="Start" />
    <bpmn:endEvent id="EndEvent_1" name="End" />
    <bpmn:sequenceFlow id="SequenceFlow_1" sourceRef="StartEvent_1" targetRef="EndEvent_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_${Date.now()}">
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1">
        <dc:Bounds x="179" y="79" width="36" height="36" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="185" y="115" width="24" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1">
        <dc:Bounds x="279" y="79" width="36" height="36" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="289" y="115" width="20" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="SequenceFlow_1_di" bpmnElement="SequenceFlow_1">
        <di:waypoint x="215" y="97" />
        <di:waypoint x="279" y="97" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
};

// Fix BPMN data that lacks diagram
const fixBPMNDiagram = (bpmnXml, workflowName) => {
  if (!bpmnXml) return createBPMNWithDiagram(workflowName);
  
  // Check if it has diagram
  if (bpmnXml.includes('BPMNDiagram') && bpmnXml.includes('BPMNPlane')) {
    return bpmnXml; // Already has diagram
  }
  
  // Try to parse and add diagram
  try {
    if (bpmnXml.includes('<process') || bpmnXml.includes('<bpmn:process')) {
      // Has process but no diagram - return basic diagram
      return createBPMNWithDiagram(workflowName);
    }
  } catch (error) {
    console.log('Error parsing BPMN, using default:', error);
  }
  
  return createBPMNWithDiagram(workflowName);
};

// --- DB INIT (PostgreSQL) ---
// Test database connection on startup
testConnection();

// Initialize PostgreSQL tables automatically on startup
const initializeDatabase = async () => {
  try {
    console.log('🔄 Initializing PostgreSQL tables...');
    const migrationSQL = fs.readFileSync(path.join(__dirname, 'migration.sql'), 'utf8');
    await db.query(migrationSQL);
    console.log('✅ PostgreSQL tables initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error.message);
    console.log('💡 Make sure to run the migration.sql file manually if needed');
  }
};

// Initialize database on startup - DISABLED FOR DEBUGGING
// initializeDatabase();
// --- Helpers / Hooks ---
const safeParseJson = (s) => {
  try { return s ? JSON.parse(s) : {}; } catch (_) { return {}; }
};

// Database query helpers - convert SQLite style to PostgreSQL
const dbHelpers = {
  // Get single row - equivalent to db.get
  get: async (query, params = []) => {
    const result = await db.query(query, params);
    return result.rows[0] || null;
  },
  
  // Get all rows - equivalent to db.all
  all: async (query, params = []) => {
    const result = await db.query(query, params);
    return result.rows || [];
  },
  
  // Run query - equivalent to db.run
  run: async (query, params = []) => {
    const result = await db.query(query, params);
    return {
      changes: result.rowCount,
      lastID: result.rows?.[0]?.id || null
    };
  },
  
  // Run query and return inserted ID
  runWithId: async (query, params = []) => {
    // For INSERT queries, add RETURNING id
    const queryWithReturn = query.includes('INSERT') && !query.includes('RETURNING') 
      ? query + ' RETURNING id' 
      : query;
    const result = await db.query(queryWithReturn, params);
    return result.rows?.[0]?.id || null;
  }
};
const stringifyJson = (o) => {
  try { return JSON.stringify(o || {}); } catch (_) { return '{}'; }
};

// HTTP helper for service handlers (use global fetch if available, fallback to node-fetch)
const getFetch = () => (typeof fetch === 'function' ? fetch : (...args) => import('node-fetch').then(({ default: f }) => f(...args)));
async function httpPostJson(url, payload) {
  const f = getFetch();
  const res = await f(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {})
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
  try { return JSON.parse(text); } catch (_) { return { raw: text }; }
}

// BPMN Processing Helpers
const BPMNValidator = {
  validateWorkflow(activities, transitions) {
    const errors = [];
    const activityIds = new Set(activities.map(a => a.id));
    
    // Kiểm tra có start activity
    const hasStart = activities.some(a => a.type === 'start');
    if (!hasStart) errors.push('Workflow phải có ít nhất một Start Event');
    
    // Kiểm tra có end activity
    const hasEnd = activities.some(a => a.type === 'end');
    if (!hasEnd) errors.push('Workflow phải có ít nhất một End Event');
    
    // Kiểm tra transitions hợp lệ
    transitions.forEach(t => {
      if (!activityIds.has(t.from_activity_id)) {
        errors.push(`Transition ${t.id}: from_activity_id ${t.from_activity_id} không tồn tại`);
      }
      if (!activityIds.has(t.to_activity_id)) {
        errors.push(`Transition ${t.id}: to_activity_id ${t.to_activity_id} không tồn tại`);
      }
    });
    
    // Kiểm tra dead-end activities (không có outgoing transition)
    const hasOutgoing = new Set(transitions.map(t => t.from_activity_id));
    const deadEnds = activities.filter(a => a.type !== 'end' && !hasOutgoing.has(a.id));
    deadEnds.forEach(a => {
      errors.push(`Activity ${a.name} (${a.id}) không có transition đi tiếp và không phải End Event`);
    });
    
    return errors;
  },
  
  detectCycles(activities, transitions) {
    const graph = new Map();
    activities.forEach(a => graph.set(a.id, []));
    transitions.forEach(t => {
      if (graph.has(t.from_activity_id)) {
        graph.get(t.from_activity_id).push(t.to_activity_id);
      }
    });
    
    const visited = new Set();
    const recursionStack = new Set();
    
    function hasCycle(nodeId) {
      if (recursionStack.has(nodeId)) return true;
      if (visited.has(nodeId)) return false;
      
      visited.add(nodeId);
      recursionStack.add(nodeId);
      
      const neighbors = graph.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (hasCycle(neighbor)) return true;
      }
      
      recursionStack.delete(nodeId);
      return false;
    }
    
    for (const activityId of graph.keys()) {
      if (hasCycle(activityId)) {
        return [`Phát hiện vòng lặp trong workflow bắt đầu từ activity ${activityId}`];
      }
    }
    return [];
  }
};

const BPMNExporter = {
  generateBPMN(workflow, activities, transitions) {
    const processId = `Process_${workflow.id}`;
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" 
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" 
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" 
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI" 
                  xmlns:wf="http://workflow.local/schema"
                  id="Definitions_${workflow.id}" 
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="${processId}" name="${workflow.name}" isExecutable="true">
${activities.map(a => this.generateActivityXML(a)).join('')}
${transitions.map(t => this.generateTransitionXML(t)).join('')}
  </bpmn:process>
</bpmn:definitions>`;
    return xml;
  },
  
  generateActivityXML(activity) {
    const id = `Activity_${activity.id}`;
    const name = activity.name || '';
    const handler = activity.handler || '';
    
    switch (activity.type) {
      case 'start':
        return `    <bpmn:startEvent id="${id}" name="${name}" />
`;
      case 'end':
        return `    <bpmn:endEvent id="${id}" name="${name}" />
`;
      case 'service':
        return `    <bpmn:serviceTask id="${id}" name="${name}">
      <bpmn:extensionElements>
        <wf:handler>${handler}</wf:handler>
      </bpmn:extensionElements>
    </bpmn:serviceTask>
`;
      case 'exclusiveGateway':
        return `    <bpmn:exclusiveGateway id="${id}" name="${name}" />
`;
      case 'parallelGateway':
        return `    <bpmn:parallelGateway id="${id}" name="${name}" />
`;
      default: // user, role, department, group
        return `    <bpmn:userTask id="${id}" name="[${activity.type}] ${name}">
      <bpmn:extensionElements>
        <wf:type>${activity.type}</wf:type>
      </bpmn:extensionElements>
    </bpmn:userTask>
`;
    }
  },
  
  generateTransitionXML(transition) {
    const id = `Flow_${transition.id}`;
    const sourceRef = `Activity_${transition.from_activity_id}`;
    const targetRef = `Activity_${transition.to_activity_id}`;
    const condition = transition.condition || '';
    return `    <bpmn:sequenceFlow id="${id}" name="${condition}" sourceRef="${sourceRef}" targetRef="${targetRef}" />
`;
  }
};

// Hook có thể mở rộng theo nghiệp vụ. Hiện tại là no-op, trả Promise.resolve().
// Registry handler cho service task (tùy biến theo hệ thống thực)
const serviceHandlers = {
  // Ví dụ handler thực tế: gọi HTTP ra ngoài (thay URL dịch vụ thật của bạn)
  NotifyERP: async ({ instance, context }) => {
    // idempotent: nếu đã có cờ erpSynced trong context thì bỏ qua
    if (context && context.erpSynced) return;
    try {
      // Gọi thử dịch vụ demo (httpbin). Thay bằng endpoint ERP thực tế và payload phù hợp
      await httpPostJson('https://httpbin.org/post', {
        instanceId: instance.id,
        businessId: instance.business_id,
        context
      });
      await insertOutbox('NotifyERP', { instanceId: instance.id, businessId: instance.business_id });
    } catch (e) {
      // Ghi outbox failed event hoặc log lỗi theo nhu cầu
      await insertOutbox('NotifyERP', { instanceId: instance.id, businessId: instance.business_id, error: e.message || String(e) });
    }
    // cập nhật context đánh dấu đã đồng bộ
    const row = await dbHelpers.get('SELECT context_json FROM WorkflowInstance WHERE id = $1', [instance.id]);
    const ctx = safeParseJson(row && row.context_json);
    ctx.erpSynced = true;
    await dbHelpers.run('UPDATE WorkflowInstance SET context_json = $1 WHERE id = $2', [stringifyJson(ctx), instance.id]);
  },

  // Handler gửi thông báo phê duyệt
  SendApprovalNotification: async ({ instance, context }) => {
    // Kiểm tra đã gửi chưa để tránh duplicate
    if (context && context.approvalNotificationSent) return;
    
    try {
      // Lấy thông tin workflow và context để tạo nội dung thông báo
      const approverName = context?.approver?.name || 'Lãnh đạo';
      const requesterName = context?.requester?.name || 'Nhân viên';
      const requestType = context?.requestType || 'Đơn xin nghỉ';
      const decision = context?.decision || 'Approved';
      const reason = context?.reason || '';
      
      // Tạo nội dung email/thông báo
      const emailData = {
        to: context?.requester?.email || 'employee@company.com',
        cc: context?.approver?.email || 'manager@company.com',
        subject: `${decision === 'Approved' ? '✅ Đã phê duyệt' : '❌ Từ chối'}: ${requestType}`,
        body: `
Kính gửi ${requesterName},

${requestType} của bạn đã được ${approverName} ${decision === 'Approved' ? 'phê duyệt' : 'từ chối'}.

Chi tiết:
- ID Workflow: ${instance.id}
- Người phê duyệt: ${approverName}
- Quyết định: ${decision}
${reason ? `- Lý do: ${reason}` : ''}
- Thời gian: ${new Date().toLocaleString('vi-VN')}

${decision === 'Approved' ? 
  'Bạn có thể tiến hành theo kế hoạch đã đăng ký.' : 
  'Vui lòng liên hệ với người phê duyệt để biết thêm chi tiết.'}

Trân trọng,
Hệ thống Workflow
        `.trim()
      };

      // Gửi vào Outbox để xử lý bất đồng bộ
      await insertOutbox('SendEmail', {
        instanceId: instance.id,
        businessId: instance.business_id,
        emailData,
        notificationType: 'approval_result'
      });

      // Có thể thêm thông báo qua các kênh khác
      if (context?.requester?.phone) {
        await insertOutbox('SendSMS', {
          instanceId: instance.id,
          phone: context.requester.phone,
          message: `${requestType} của bạn đã được ${decision === 'Approved' ? 'phê duyệt' : 'từ chối'} bởi ${approverName}`
        });
      }

      // Thông báo qua Slack/Teams nếu có
      if (context?.teamChannel) {
        await insertOutbox('SendSlackNotification', {
          instanceId: instance.id,
          channel: context.teamChannel,
          message: `📋 ${requestType} của ${requesterName} đã được ${approverName} ${decision === 'Approved' ? '✅ phê duyệt' : '❌ từ chối'}`
        });
      }

    } catch (e) {
      // Ghi lỗi vào outbox để debug
      await insertOutbox('SendApprovalNotification', {
        instanceId: instance.id,
        businessId: instance.business_id,
        error: e.message || String(e)
      });
    }

    // Đánh dấu đã gửi thông báo
    const row = await dbHelpers.get('SELECT context_json FROM WorkflowInstance WHERE id = $1', [instance.id]);
    const ctx = safeParseJson(row && row.context_json);
    ctx.approvalNotificationSent = true;
    ctx.notificationSentAt = new Date().toISOString();
    await dbHelpers.run('UPDATE WorkflowInstance SET context_json = $1 WHERE id = $2', [stringifyJson(ctx), instance.id]);
  },

  // Handler gửi email generic
  SendEmail: async ({ instance, context }) => {
    // Giả lập gửi email (thay bằng service thật như SendGrid, AWS SES)
    console.log('📧 Sending email:', context?.emailData || context);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Log success
    await insertOutbox('EmailSent', {
      instanceId: instance.id,
      recipient: context?.emailData?.to || 'unknown',
      subject: context?.emailData?.subject || 'No subject',
      sentAt: new Date().toISOString()
    });
  },

  // Handler gửi SMS
  SendSMS: async ({ instance, context }) => {
    console.log('📱 Sending SMS:', context);
    await new Promise(resolve => setTimeout(resolve, 50));
    
    await insertOutbox('SMSSent', {
      instanceId: instance.id,
      phone: context?.phone || 'unknown',
      sentAt: new Date().toISOString()
    });
  }
};

async function getInstanceContext(instanceId) {
  const row = await dbHelpers.get('SELECT context_json FROM WorkflowInstance WHERE id = $1', [instanceId]);
  return safeParseJson(row && row.context_json);
}

function orderTransitionsForEval(list) {
  const arr = Array.isArray(list) ? [...list] : [];
  arr.sort((a, b) => {
    const pa = Number.isFinite(a.priority) ? a.priority : 9999;
    const pb = Number.isFinite(b.priority) ? b.priority : 9999;
    if (pa !== pb) return pa - pb;
    return a.id - b.id;
  });
  return arr;
}

async function runServiceTask({ activityDef, instance, activityInstanceId, depth = 0 }) {
  if (depth > 10) return; // tránh vòng lặp vô hạn
  const context = await getInstanceContext(instance.id);
  const handlerName = activityDef.handler || null;
  const handler = handlerName && serviceHandlers[handlerName];
  try {
    if (handler) {
      await handler({ instance, context });
    }
  } catch (_) {
    // có thể log lỗi, nhưng không chặn luồng cơ bản
  }

  // Hoàn thành service activity
  await dbHelpers.run('UPDATE ActivityInstance SET status = $1 WHERE id = $2', ['Completed', activityInstanceId]);

  // Xử lý gateway logic
  if (activityDef.type === 'exclusiveGateway') {
    await handleExclusiveGateway({ activityDef, instance, activityInstanceId, context, depth });
  } else if (activityDef.type === 'parallelGateway') {
    await handleParallelGateway({ activityDef, instance, activityInstanceId, context, depth });
  } else {
    // Logic cũ cho các task thường
    await handleNormalTransition({ activityDef, instance, activityInstanceId, context, depth });
  }
}

async function handleExclusiveGateway({ activityDef, instance, activityInstanceId, context, depth }) {
  const allTrans = await dbHelpers.all('SELECT * FROM TransitionDefinition WHERE from_activity_id = $1 ORDER BY id ASC', [activityDef.id]);
  const ordered = orderTransitionsForEval(allTrans);
  let trans = chooseTransition(ordered, null, context);
  if (!trans) {
    // thử default
    trans = ordered.find(t => t && t.is_default);
  }
  if (trans) {
    await createNextActivity({ trans, instance, activityInstanceId, depth });
  }
}

async function handleParallelGateway({ activityDef, instance, activityInstanceId, context, depth }) {
  // Parallel Gateway: tạo tất cả các activity tiếp theo
  const allTrans = await dbHelpers.all('SELECT * FROM TransitionDefinition WHERE from_activity_id = $1 ORDER BY id ASC', [activityDef.id]);
  
  for (const trans of allTrans) {
    await createNextActivity({ trans, instance, activityInstanceId, depth });
  }
}

async function handleNormalTransition({ activityDef, instance, activityInstanceId, context, depth }) {
  // Chọn transition tiếp theo
  const allTrans = await dbHelpers.all('SELECT * FROM TransitionDefinition WHERE from_activity_id = $1 ORDER BY id ASC', [activityDef.id]);
  const ordered = orderTransitionsForEval(allTrans);
  let trans = chooseTransition(ordered, null, context);
  if (!trans) {
    // thử default
    trans = ordered.find(t => t && t.is_default);
  }
  if (trans) {
    await createNextActivity({ trans, instance, activityInstanceId, depth });
  }
}

async function createNextActivity({ trans, instance, activityInstanceId, depth }) {
  // Tạo activity kế tiếp
  const nextActivity = await dbHelpers.get('SELECT * FROM ActivityDefinition WHERE id = $1', [trans.to_activity_id]);
  if (!nextActivity) return;

  const toAIId = await dbHelpers.runWithId(
    `INSERT INTO ActivityInstance (workflow_instance_id, activity_definition_id, status, created_at)
     VALUES ($1, $2, 'Running', CURRENT_TIMESTAMP)`,
    [instance.id, nextActivity.id]
  );

  await dbHelpers.run(
    `INSERT INTO TransitionLog (from_activity_instance_id, to_activity_instance_id, condition, acted_by_user_id)
     VALUES ($1, $2, $3, NULL)`,
    [activityInstanceId, toAIId, trans.condition || '']
  );

  // Nếu là terminal (end event hoặc không có outgoing), kết thúc instance
  if (nextActivity.type === 'end') {
    await dbHelpers.run('UPDATE WorkflowInstance SET state = $1 WHERE id = $2', ['Completed', instance.id]);
    return;
  }
  
  const cntRow = await dbHelpers.get('SELECT COUNT(*) AS cnt FROM TransitionDefinition WHERE from_activity_id = $1', [nextActivity.id]);
  const isTerminal = !cntRow || cntRow.cnt === 0;

  if (isTerminal) {
    await dbHelpers.run('UPDATE WorkflowInstance SET state = $1 WHERE id = $2', ['Completed', instance.id]);
    return;
  }

  // Tạo assignee (unassigned nếu không xác định)
  const assign = (assignment_type, cols, vals) => {
    const baseCols = ['activity_instance_id', 'assignment_type', ...cols, 'is_completed'];
    const placeholders = baseCols.map((_, i) => `$${i + 1}`).join(', ');
    const sql = `INSERT INTO TaskAssignee (${baseCols.join(', ')}) VALUES (${placeholders})`;
    return dbHelpers.run(sql, [toAIId, assignment_type, ...vals, false]);
  };

  if (['department', 'role', 'user', 'group'].includes(nextActivity.type)) {
    // Không có actor ở service, tạm để unassigned để người khác tiếp quản
    await assign('unassigned', [], []);
  } else if (nextActivity.type === 'service') {
    // Gọi tiếp service task kế tiếp
    await runServiceTask({ activityDef: nextActivity, instance, activityInstanceId: toAIId, depth: depth + 1 });
    return;
  } else {
    await assign('unassigned', [], []);
  }

  // Gọi onEnter cho bước kế tiếp (có thể là service)
  await hooks.onEnterActivity({ activityDef: nextActivity, instance, activityInstanceId: toAIId });
}

async function handleParallelGateway({ activityDef, instance, activityInstanceId, context, depth }) {
  // Parallel Gateway: tạo tất cả các activity tiếp theo
  const allTrans = await dbHelpers.all('SELECT * FROM TransitionDefinition WHERE from_activity_id = $1 ORDER BY id ASC', [activityDef.id]);
  
  for (const trans of allTrans) {
    await createNextActivity({ trans, instance, activityInstanceId, depth });
  }
}

const hooks = {
  async beforeCompleteTask({ task, actor, instance, payload, context }) {
    // validate nghiệp vụ trước khi complete task
    // Ví dụ: nếu activity hiện tại là bước phê duyệt (id 12) thì cần hasAllDocuments=true
    if (task && task.activity_definition_id === 12) {
      if (!context || context.hasAllDocuments !== true) {
        throw new Error('Thiếu hồ sơ: yêu cầu hasAllDocuments = true trước khi phê duyệt');
      }
    }
    // Ví dụ: amount > 0 nếu có
    if (context && context.amount !== undefined && Number(context.amount) <= 0) {
      throw new Error('Giá trị amount phải > 0');
    }
  },
  async onEnterActivity({ activityDef, instance, activityInstanceId }) {
    // xử lý khi vào bước mới (ví dụ service task)
    // Audit log: enter activity
    await dbHelpers.run(
      `INSERT INTO DomainLog (workflow_instance_id, activity_definition_id, action, metadata_json, created_at)
       VALUES ($1, $2, 'EnterActivity', $3, CURRENT_TIMESTAMP)`,
      [instance.id, activityDef.id, stringifyJson({ activityInstanceId })]
    );
    if (activityDef.type === 'service') {
      await runServiceTask({ activityDef, instance, activityInstanceId });
    }
  },
  async afterTransition({ fromActivityDefId, toActivityDefId, instance, actor, condition, context }) {
    // Audit log chuyển bước
    await dbHelpers.run(
      `INSERT INTO DomainLog (workflow_instance_id, activity_definition_id, action, metadata_json, created_at)
       VALUES ($1, $2, 'AfterTransition', $3, CURRENT_TIMESTAMP)`,
      [instance.id, toActivityDefId, stringifyJson({ fromActivityDefId, condition, actorUserId: actor && actor.id })]
    );
    // Ví dụ side-effect: Approved/Rejected gửi email; Done service -> NotifyERP
    const cond = (condition || '').toLowerCase();
    if (cond === 'approved') {
      insertOutbox('SendEmail', { instanceId: instance.id, subject: 'Approved', body: 'Your request has been approved.' });
    } else if (cond === 'rejected') {
      insertOutbox('SendEmail', { instanceId: instance.id, subject: 'Rejected', body: 'Your request has been rejected.' });
    }
  }
};

function insertOutbox(event_type, payload) {
  return dbHelpers.run(
    `INSERT INTO Outbox (event_type, payload_json, status, created_at) VALUES ($1, $2, 'PENDING', CURRENT_TIMESTAMP)`,
    [event_type, stringifyJson(payload)]
  );
}

async function processOutboxBatch() {
  try {
    console.log('=== DEBUG: processOutboxBatch running...');
    const rows = await dbHelpers.all("SELECT * FROM OutboxEvent WHERE status IS NULL OR status = 'PENDING' LIMIT 10");
    console.log('=== DEBUG: processOutboxBatch found', rows ? rows.length : 0, 'rows');
    if (!rows || rows.length === 0) return;
    
    for (const r of rows) {
      const payload = safeParseJson(r.payload);
      let status = 'DONE';
      let error = null;
      try {
        if (r.event_type === 'SendEmail') {
          // giả lập gửi email
          await new Promise((res) => setTimeout(res, 50));
        } else if (r.event_type === 'NotifyERP') {
          await new Promise((res) => setTimeout(res, 50));
        } else {
          // không biết loại, đánh dấu DONE để tránh kẹt hàng đợi
        }
      } catch (e) {
        status = 'FAILED';
        error = (e && e.message) || String(e);
      }
      await dbHelpers.run(`UPDATE OutboxEvent SET status = $1, error = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`, [status, error, r.id]);
    }
  } catch (error) {
    console.error('Outbox processing error:', error);
  }
}

// setInterval(processOutboxBatch, 3000); // Temporarily disabled for debugging

// Outbox APIs
app.get('/api/outbox', async (req, res) => {
  try {
    const status = req.query && req.query.status;
    const limit = Math.min(parseInt((req.query && req.query.limit) || '50', 10) || 50, 200);
    let sql = 'SELECT * FROM OutboxEvent';
    const params = [];
    if (status) {
      sql += ' WHERE status = $1';
      params.push(status);
    }
    sql += ' ORDER BY id DESC LIMIT $' + (params.length + 1);
    params.push(limit);
    
    const rows = await dbHelpers.all(sql, params);
    res.json(rows || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/outbox/:id/retry', idParamValidation, handleValidationErrors, async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const result = await dbHelpers.run(`UPDATE Outbox SET status = 'PENDING', error = NULL, processed_at = NULL WHERE id = $1 AND status = 'FAILED'`, [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found or not FAILED' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Đánh giá biểu thức điều kiện an to��n (chỉ cho phép truy cập ctx, toán tử cơ bản)
// Format: condition bắt đầu bằng '=' ví dụ: "= ctx.amount > 10000 && ctx.hasAllDocuments"
function evaluateSafeExpression(expr, ctx) {
  if (typeof expr !== 'string' || !expr.trim().startsWith('=')) return false;
  const body = expr.trim().slice(1); // bỏ '='
  // Chỉ cho phép ký tự an toàn
  const safe = /^[\s\w\d_$.><=!&|()'"+-/*%?:]+$/.test(body);
  if (!safe) return false;
  // Không cho phép từ khóa nguy hiểm
  const banned = /(global|process|require|Function|constructor|window|this|eval)/i;
  if (banned.test(body)) return false;
  try {
    // Tạo hàm với đối số ctx, chỉ đánh giá biểu thức boolean
    // eslint-disable-next-line no-new-func
    const fn = new Function('ctx', `try { return !!(${body}); } catch (e) { return false; }`);
    return !!fn(ctx || {});
  } catch (_) {
    return false;
  }
}

function chooseTransition(allTransitions, inputCondition, ctx) {
  if (!Array.isArray(allTransitions) || allTransitions.length === 0) return null;
  const ic = (inputCondition || '').toLowerCase();
  if (ic) {
    const exact = allTransitions.find(t => (t.condition || '').toLowerCase() === ic);
    if (exact) return exact;
  }
  // Tìm transition có condition là biểu thức bắt đầu bằng '=' và true
  for (const t of allTransitions) {
    const c = t.condition || '';
    if (typeof c === 'string' && c.trim().startsWith('=')) {
      if (evaluateSafeExpression(c, ctx)) return t;
    }
  }
  // fallback: nếu chỉ có 1 transition thì chọn luôn
  if (allTransitions.length === 1) return allTransitions[0];
  return null;
}

// --- API ---

// GET /api/workflows - Danh sách tất cả workflow definitions (phải đứng trước /api/workflows/:id)
app.get('/api/workflows', async (req, res) => {
  try {
    const rows = await dbHelpers.all('SELECT * FROM WorkflowDefinition ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lấy full definition + activity + transition của 1 workflow
app.get('/api/workflows/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const workflow = await dbHelpers.get('SELECT * FROM WorkflowDefinition WHERE id = $1', [id]);
    
    if (!workflow) return res.status(404).json({ error: 'Not found' });

    // Fix BPMN XML if it lacks diagram
    if (workflow.bpmn_xml) {
      workflow.bpmn_xml = fixBPMNDiagram(workflow.bpmn_xml, workflow.name);
    } else {
      workflow.bpmn_xml = createBPMNWithDiagram(workflow.name);
    }

    const activities = await dbHelpers.all(
      'SELECT * FROM ActivityDefinition WHERE workflow_definition_id = $1',
      [id]
    );

    const transitions = await dbHelpers.all(
      'SELECT * FROM TransitionDefinition WHERE from_activity_id IN (SELECT id FROM ActivityDefinition WHERE workflow_definition_id = $1)',
      [id]
    );

    res.json({ workflow, activities, transitions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Backward-compatible endpoint (FE cũ đang gọi)
app.get('/api/workflow/:id', (req, res) => {
  req.url = `/api/workflows/${req.params.id}`;
  return app._router.handle(req, res, () => {});
});

// Lấy danh sách task cho 1 user (dựa vào group member demo)
app.get('/api/users/:userId/tasks', async (req, res) => {
  console.log('[DEBUG] /api/users/:userId/tasks endpoint hit');
  const userId = req.params.userId;
  console.log('[DEBUG] userId:', userId);

  // Ở đây demo: task assign qua group; thực tế cần join role/department nữa.
  const sql = `
    SELECT ta.*, ai.activity_definition_id, ad.name AS activity_name,
           wi.business_id, wi.state
    FROM TaskAssignee ta
    JOIN ActivityInstance ai ON ta.activity_instance_id = ai.id
    JOIN WorkflowInstance wi ON ai.workflow_instance_id = wi.id
    JOIN ActivityDefinition ad ON ai.activity_definition_id = ad.id
    WHERE ta.is_completed = false
      AND ta.group_id IN (
        SELECT group_id FROM GroupMember WHERE user_id = $1
      )
  `;

  try {
    console.log('[DEBUG] About to execute SQL:', sql);
    const rows = await dbHelpers.all(sql, [userId]);
    console.log('[DEBUG] Query successful, rows:', rows.length);
    res.json(rows);
  } catch (err) {
    console.error('[DEBUG] Query failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/test-endpoint', async (req, res) => {
  res.json({ message: 'Test successful' });
});

// Demo API để test validation và gateway logic
app.post('/api/demo/validation-test', (req, res) => {
  // Tạo các test case minh họa
  const testCases = {
    validWorkflow: {
      activities: [
        { id: 1, type: 'start', name: 'Bắt đầu' },
        { id: 2, type: 'user', name: 'Soạn thảo' },
        { id: 3, type: 'exclusiveGateway', name: 'Kiểm tra số tiền' },
        { id: 4, type: 'user', name: 'Phê duyệt thường' },
        { id: 5, type: 'user', name: 'Phê duyệt cấp cao' },
        { id: 6, type: 'end', name: 'Kết thúc' }
      ],
      transitions: [
        { id: 1, from_activity_id: 1, to_activity_id: 2, condition: 'Done' },
        { id: 2, from_activity_id: 2, to_activity_id: 3, condition: 'Done' },
        { id: 3, from_activity_id: 3, to_activity_id: 4, condition: '= ctx.amount <= 10000', priority: 1 },
        { id: 4, from_activity_id: 3, to_activity_id: 5, condition: '= ctx.amount > 10000', priority: 2 },
        { id: 5, from_activity_id: 4, to_activity_id: 6, condition: 'Done' },
        { id: 6, from_activity_id: 5, to_activity_id: 6, condition: 'Done' }
      ]
    },
    
    invalidWorkflow: {
      activities: [
        { id: 1, type: 'user', name: 'Soạn thảo' }, // Thiếu Start Event
        { id: 2, type: 'user', name: 'Phê duyệt' }   // Thiếu End Event + Dead-end
      ],
      transitions: [
        { id: 1, from_activity_id: 1, to_activity_id: 2, condition: 'Done' }
        // Activity 2 không có transition đi tiếp → Dead-end
      ]
    },
    
    cyclicWorkflow: {
      activities: [
        { id: 1, type: 'start', name: 'Bắt đầu' },
        { id: 2, type: 'user', name: 'A' },
        { id: 3, type: 'user', name: 'B' },
        { id: 4, type: 'user', name: 'C' },
        { id: 5, type: 'end', name: 'Kết thúc' }
      ],
      transitions: [
        { id: 1, from_activity_id: 1, to_activity_id: 2, condition: 'Done' },
        { id: 2, from_activity_id: 2, to_activity_id: 3, condition: 'Done' },
        { id: 3, from_activity_id: 3, to_activity_id: 4, condition: 'Done' },
        { id: 4, from_activity_id: 4, to_activity_id: 2, condition: 'Loop' }, // Cycle: 4→2→3→4
        { id: 5, from_activity_id: 4, to_activity_id: 5, condition: 'End' }
      ]
    },
    
    parallelGatewayWorkflow: {
      activities: [
        { id: 1, type: 'start', name: 'Bắt đầu' },
        { id: 2, type: 'user', name: 'Chuẩn bị hồ sơ' },
        { id: 3, type: 'parallelGateway', name: 'Xử lý song song' },
        { id: 4, type: 'user', name: 'Kiểm tra pháp lý' },
        { id: 5, type: 'user', name: 'Kiểm tra tài chính' },
        { id: 6, type: 'user', name: 'Tổng hợp kết quả' },
        { id: 7, type: 'end', name: 'Kết thúc' }
      ],
      transitions: [
        { id: 1, from_activity_id: 1, to_activity_id: 2, condition: 'Done' },
        { id: 2, from_activity_id: 2, to_activity_id: 3, condition: 'Done' },
        { id: 3, from_activity_id: 3, to_activity_id: 4, condition: 'Legal' },    // Parallel: tạo cả 2
        { id: 4, from_activity_id: 3, to_activity_id: 5, condition: 'Financial' }, // Parallel: tạo cả 2
        { id: 5, from_activity_id: 4, to_activity_id: 6, condition: 'Done' },
        { id: 6, from_activity_id: 5, to_activity_id: 6, condition: 'Done' },
        { id: 7, from_activity_id: 6, to_activity_id: 7, condition: 'Done' }
      ]
    }
  };
  
  const testType = req.query.type || 'all';
  
  if (testType === 'all') {
    const results = {};
    
    for (const [name, workflow] of Object.entries(testCases)) {
      const validationErrors = BPMNValidator.validateWorkflow(workflow.activities, workflow.transitions);
      const cycleErrors = BPMNValidator.detectCycles(workflow.activities, workflow.transitions);
      
      results[name] = {
        isValid: validationErrors.length === 0 && cycleErrors.length === 0,
        validationErrors,
        cycleErrors,
        summary: {
          activities: workflow.activities.length,
          transitions: workflow.transitions.length,
          startEvents: workflow.activities.filter(a => a.type === 'start').length,
          endEvents: workflow.activities.filter(a => a.type === 'end').length,
          gateways: workflow.activities.filter(a => a.type.includes('Gateway')).length
        }
      };
    }
    
    return res.json({
      message: 'Demo validation test results',
      results,
      explanation: {
        validWorkflow: 'Workflow hợp lệ với Start/End Events, Exclusive Gateway có priority',
        invalidWorkflow: 'Workflow không hợp lệ: thiếu Start/End Events, có dead-end activity',
        cyclicWorkflow: 'Workflow có vòng lặp: A→B→C→A',
        parallelGatewayWorkflow: 'Workflow với Parallel Gateway tạo 2 task song song'
      }
    });
  } else if (testCases[testType]) {
    const workflow = testCases[testType];
    const validationErrors = BPMNValidator.validateWorkflow(workflow.activities, workflow.transitions);
    const cycleErrors = BPMNValidator.detectCycles(workflow.activities, workflow.transitions);
    
    return res.json({
      testType,
      workflow,
      isValid: validationErrors.length === 0 && cycleErrors.length === 0,
      validationErrors,
      cycleErrors
    });
  } else {
    return res.status(400).json({ 
      error: 'Invalid test type', 
      available: Object.keys(testCases) 
    });
  }
});

// Demo API để test gateway decision making
app.post('/api/demo/gateway-test', (req, res) => {
  const { context, transitions } = req.body || {};
  
  if (!context || !transitions) {
    return res.status(400).json({ 
      error: 'context và transitions are required',
      example: {
        context: { amount: 15000, hasAllDocuments: true },
        transitions: [
          { id: 1, condition: '= ctx.amount > 50000', priority: 1 },
          { id: 2, condition: '= ctx.amount > 10000', priority: 2 },
          { id: 3, condition: 'Done', is_default: 1 }
        ]
      }
    });
  }
  
  const ordered = orderTransitionsForEval(transitions);
  const chosen = chooseTransition(ordered, null, context);
  
  const evaluationResults = ordered.map(t => {
    let evaluated = false;
    let error = null;
    
    try {
      if (t.condition && t.condition.startsWith('=')) {
        evaluated = evaluateSafeExpression(t.condition, context);
      } else if (t.condition) {
        evaluated = false; // Simple string conditions không match
      } else {
        evaluated = true; // No condition = always true
      }
    } catch (e) {
      error = e.message;
    }
    
    return {
      ...t,
      evaluated,
      error,
      chosen: chosen && chosen.id === t.id
    };
  });
  
  return res.json({
    context,
    transitionsOriginal: transitions,
    transitionsOrdered: ordered,
    evaluationResults,
    chosenTransition: chosen,
    explanation: {
      'Exclusive Gateway': 'Chọn transition đầu tiên có điều kiện = true (theo priority)',
      'Parallel Gateway': 'Sẽ chọn TẤT CẢ transitions (không cần điều kiện)',
      'Priority System': 'Số nhỏ hơn = priority cao hơn'
    }
  });
});

// Demo API để tạo workflow mẫu "Phê duyệt với thông báo tự động"
app.post('/api/demo/create-approval-workflow', async (req, res) => {
  console.log('Request body:', req.body);
  console.log('Request headers:', req.headers);
  const workflowName = (req.body && req.body.name) || 'Quy trình phê duyệt với thông báo tự động';
  const workflowDesc = (req.body && req.body.description) || 'Soạn đơn → Phê duyệt → Gửi thông báo tự động → Kết thúc';
  
  try {
    // Tạo workflow definition
    const rowMax = await dbHelpers.get('SELECT COALESCE(MAX(id), 0) AS maxId FROM WorkflowDefinition');
    const newWorkflowId = (rowMax && rowMax.maxid ? rowMax.maxid : 0) + 1;
    
    // Insert workflow
    await dbHelpers.run(
      `INSERT INTO WorkflowDefinition (id, name, version, description, created_at, updated_at)
       VALUES ($1, $2, 1, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [newWorkflowId, workflowName, workflowDesc]
    );
    
    // Get next activity ID
    const rowMaxA = await dbHelpers.get('SELECT COALESCE(MAX(id), 0) AS maxId FROM ActivityDefinition');
    let nextActivityId = (rowMaxA && rowMaxA.maxid ? rowMaxA.maxid : 0) + 1;
    
    // Create activities
    const activities = [
      { id: nextActivityId++, name: 'Bắt đầu', type: 'start' },
      { id: nextActivityId++, name: 'Soạn đơn xin nghỉ', type: 'user' },
      { id: nextActivityId++, name: 'Lãnh đạo phê duyệt', type: 'role' },
      { id: nextActivityId++, name: 'Gửi thông báo', type: 'service', handler: 'SendApprovalNotification' },
      { id: nextActivityId++, name: 'Kết thúc', type: 'end' }
    ];
    
    // Insert activities
    for (const a of activities) {
      await dbHelpers.run(
        `INSERT INTO ActivityDefinition (id, workflow_definition_id, name, type, handler) VALUES ($1, $2, $3, $4, $5)`,
        [a.id, newWorkflowId, a.name, a.type, a.handler || null]
      );
    }
    
    // Get next transition ID  
    const rowMaxT = await dbHelpers.get('SELECT COALESCE(MAX(id), 0) AS maxId FROM TransitionDefinition');
    let nextTransitionId = (rowMaxT && rowMaxT.maxid ? rowMaxT.maxid : 0) + 1;
    
    // Create transitions
    const transitions = [
      { id: nextTransitionId++, from: activities[0].id, to: activities[1].id, condition: 'Done' },
      { id: nextTransitionId++, from: activities[1].id, to: activities[2].id, condition: 'Done' },
      { id: nextTransitionId++, from: activities[2].id, to: activities[3].id, condition: 'Approved', priority: 1 },
      { id: nextTransitionId++, from: activities[2].id, to: activities[4].id, condition: 'Rejected', priority: 2 },
      { id: nextTransitionId++, from: activities[3].id, to: activities[4].id, condition: 'Done' }
    ];
    
    // Insert transitions
    for (const t of transitions) {
      await dbHelpers.run(
        `INSERT INTO TransitionDefinition (id, from_activity_id, to_activity_id, condition, priority) VALUES ($1, $2, $3, $4, $5)`,
        [t.id, t.from, t.to, t.condition, t.priority || null]
      );
    }
    
    // Generate BPMN XML
    const bpmnXml = generateApprovalWorkflowBPMN({
      id: newWorkflowId,
      name: workflowName
    }, activities, transitions);
    
    // Update workflow with BPMN
    await dbHelpers.run(
      `UPDATE WorkflowDefinition SET bpmn_xml = $1 WHERE id = $2`,
      [bpmnXml, newWorkflowId]
    );
    
    return res.json({
      success: true,
      workflowId: newWorkflowId,
      name: workflowName,
      description: workflowDesc,
      activities: activities.length,
      transitions: transitions.length,
      message: '✅ Đã tạo workflow phê duyệt với thông báo tự động!',
      usage: {
        step1: 'Vào tab BPMN Editor để xem workflow',
        step2: 'Start instance với initial_context chứa thông tin requester, approver',
        step3: 'Complete tasks với condition "Approved" hoặc "Rejected"',
        step4: 'Kiểm tra Outbox để xem events gửi thông báo'
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Demo: Tạo workflow với xử lý rejection nâng cao (parallel gateway)
app.post('/api/demo/create-advanced-approval-workflow', async (req, res) => {
  try {
    console.log('Request body:', req.body);
    console.log('Request headers:', req.headers);
    const workflowName = (req.body && req.body.name) || 'Quy trình phê duyệt nâng cao (Xử lý từ chối)';
    const workflowDesc = (req.body && req.body.description) || 'Soạn đơn → Phê duyệt → [Approved: Thông báo] / [Rejected: Song song gửi thông báo + trả về soạn lại]';
    
    // Get next workflow ID
    const maxWorkflowResult = await dbHelpers.get('SELECT COALESCE(MAX(id), 0) AS max_id FROM WorkflowDefinition');
    const newWorkflowId = (maxWorkflowResult?.max_id || 0) + 1;
    
    // Insert workflow
    await dbHelpers.run(
      `INSERT INTO WorkflowDefinition (id, name, version, description, created_at, updated_at)
       VALUES ($1, $2, 1, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [newWorkflowId, workflowName, workflowDesc]
    );
    
    // Get next activity ID
    const maxActivityResult = await dbHelpers.get('SELECT COALESCE(MAX(id), 0) AS max_id FROM ActivityDefinition');
    let nextActivityId = (maxActivityResult?.max_id || 0) + 1;
    
    // Create activities với parallel gateway
    const activities = [
      { id: nextActivityId++, name: 'Bắt đầu', type: 'start' },
      { id: nextActivityId++, name: 'Soạn đơn xin nghỉ', type: 'user' },
      { id: nextActivityId++, name: 'Lãnh đạo phê duyệt', type: 'role' },
      { id: nextActivityId++, name: 'Gửi thông báo phê duyệt', type: 'service', handler: 'SendApprovalNotification' },
      { id: nextActivityId++, name: 'Gateway từ chối', type: 'parallelGateway' },
      { id: nextActivityId++, name: 'Gửi thông báo từ chối', type: 'service', handler: 'SendRejectionNotification' },
      { id: nextActivityId++, name: 'Gateway hội tụ', type: 'parallelGateway' },
      { id: nextActivityId++, name: 'Kết thúc', type: 'end' }
    ];
    
    // Insert activities
    for (const activity of activities) {
      await dbHelpers.run(
        'INSERT INTO ActivityDefinition (id, workflow_definition_id, name, type, handler) VALUES ($1, $2, $3, $4, $5)',
        [activity.id, newWorkflowId, activity.name, activity.type, activity.handler || null]
      );
    }
    
    // Get next transition ID  
    const maxTransitionResult = await dbHelpers.get('SELECT COALESCE(MAX(id), 0) AS max_id FROM TransitionDefinition');
    let nextTransitionId = (maxTransitionResult?.max_id || 0) + 1;
    
    // Create transitions với logic phức tạp
    const transitions = [
      // Luồng chính
      { id: nextTransitionId++, from: activities[0].id, to: activities[1].id, condition: 'Done' },
      { id: nextTransitionId++, from: activities[1].id, to: activities[2].id, condition: 'Done' },
      
      // Nhánh phê duyệt
      { id: nextTransitionId++, from: activities[2].id, to: activities[3].id, condition: 'Approved', priority: 1 },
      { id: nextTransitionId++, from: activities[3].id, to: activities[7].id, condition: 'Done' },
      
      // Nhánh từ chối - vào parallel gateway
      { id: nextTransitionId++, from: activities[2].id, to: activities[4].id, condition: 'Rejected', priority: 2 },
      
      // Từ parallel gateway ra 2 nhánh song song
      { id: nextTransitionId++, from: activities[4].id, to: activities[5].id, condition: 'Done' }, // Gửi thông báo từ chối
      { id: nextTransitionId++, from: activities[4].id, to: activities[1].id, condition: 'Done' }, // Quay về soạn đơn
      
      // Hội tụ tại gateway hội tụ (nếu cần)
      { id: nextTransitionId++, from: activities[5].id, to: activities[6].id, condition: 'Done' },
      { id: nextTransitionId++, from: activities[6].id, to: activities[7].id, condition: 'Done' }
    ];
    
    // Insert transitions
    for (const transition of transitions) {
      await dbHelpers.run(
        'INSERT INTO TransitionDefinition (id, from_activity_id, to_activity_id, condition, priority) VALUES ($1, $2, $3, $4, $5)',
        [transition.id, transition.from, transition.to, transition.condition, transition.priority || null]
      );
    }
    
    res.json({
      success: true,
      workflowId: newWorkflowId,
      name: workflowName,
      description: workflowDesc,
      activities: activities.length,
      transitions: transitions.length,
      message: '✅ Đã tạo workflow phê duyệt nâng cao với xử lý từ chối!',
      features: {
        parallel_gateway: 'Xử lý song song khi từ chối',
        notification: 'Gửi thông báo từ chối tự động',
        loop_back: 'Quay về soạn đơn để sửa lại'
      },
      usage: {
        step1: 'Vào tab BPMN Editor để xem parallel gateway workflow',
        step2: 'Start instance với condition "Approved" hoặc "Rejected"',
        step3: 'Nếu Rejected: sẽ song song gửi thông báo + quay về soạn đơn',
        step4: 'Kiểm tra Outbox để xem events gửi thông báo song song'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function generateApprovalWorkflowBPMN(workflow, activities, transitions) {
  const processId = `Process_${workflow.id}`;
  
  // Generate activities XML
  const activitiesXml = activities.map(a => {
    const id = `Activity_${a.id}`;
    const name = a.name || '';
    
    switch (a.type) {
      case 'start':
        return `    <bpmn:startEvent id="${id}" name="${name}" />`;
      case 'end':
        return `    <bpmn:endEvent id="${id}" name="${name}" />`;
      case 'service':
        return `    <bpmn:serviceTask id="${id}" name="${name}">
      <bpmn:extensionElements>
        <wf:handler>${a.handler || ''}</wf:handler>
      </bpmn:extensionElements>
    </bpmn:serviceTask>`;
      case 'role':
        return `    <bpmn:userTask id="${id}" name="[role] ${name}">
      <bpmn:extensionElements>
        <wf:type>role</wf:type>
      </bpmn:extensionElements>
    </bpmn:userTask>`;
      default: // user
        return `    <bpmn:userTask id="${id}" name="[user] ${name}">
      <bpmn:extensionElements>
        <wf:type>user</wf:type>
      </bpmn:extensionElements>
    </bpmn:userTask>`;
    }
  }).join('\n');
  
  // Generate transitions XML
  const transitionsXml = transitions.map(t => {
    const id = `Flow_${t.id}`;
    const sourceRef = `Activity_${t.from}`;
    const targetRef = `Activity_${t.to}`;
    const condition = t.condition || '';
    return `    <bpmn:sequenceFlow id="${id}" name="${condition}" sourceRef="${sourceRef}" targetRef="${targetRef}" />`;
  }).join('\n');
  
  // Generate positioning for diagram
  const positions = {};
  const y = 150;
  let x = 100;
  activities.forEach((a, idx) => {
    positions[`Activity_${a.id}`] = { x: x + idx * 180, y };
  });
  
  // Generate shapes XML for diagram
  const shapesXml = activities.map(a => {
    const id = `Activity_${a.id}`;
    const pos = positions[id];
    const width = a.type === 'start' || a.type === 'end' ? 36 : 100;
    const height = 36;
    return `      <bpmndi:BPMNShape id="${id}_di" bpmnElement="${id}">
        <dc:Bounds x="${pos.x}" y="${pos.y}" width="${width}" height="${height}" />
      </bpmndi:BPMNShape>`;
  }).join('\n');
  
  // Generate edges XML for diagram
  const edgesXml = transitions.map(t => {
    const id = `Flow_${t.id}`;
    const sourcePos = positions[`Activity_${t.from}`] || { x: 100, y: 150 };
    const targetPos = positions[`Activity_${t.to}`] || { x: 300, y: 150 };
    const sourceWidth = activities.find(a => a.id === t.from)?.type === 'start' || 
                       activities.find(a => a.id === t.from)?.type === 'end' ? 36 : 100;
    return `      <bpmndi:BPMNEdge id="${id}_di" bpmnElement="${id}">
        <di:waypoint x="${sourcePos.x + sourceWidth/2}" y="${sourcePos.y + 18}" />
        <di:waypoint x="${targetPos.x + 50}" y="${targetPos.y + 18}" />
      </bpmndi:BPMNEdge>`;
  }).join('\n');
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" 
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" 
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" 
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI" 
                  xmlns:wf="http://workflow.local/schema"
                  id="Definitions_${workflow.id}" 
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="${processId}" name="${workflow.name}" isExecutable="true">
${activitiesXml}
${transitionsXml}
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_${workflow.id}">
    <bpmndi:BPMNPlane id="BPMNPlane_${workflow.id}" bpmnElement="${processId}">
${shapesXml}
${edgesXml}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
}

// Export BPMN XML từ workflow definition
app.get('/api/workflows/:id/export-bpmn', async (req, res) => {
  const workflowId = Number(req.params.id);
  if (!workflowId || Number.isNaN(workflowId)) return res.status(400).json({ error: 'Invalid workflow id' });

  try {
    const workflow = await dbHelpers.get('SELECT * FROM WorkflowDefinition WHERE id = $1', [workflowId]);
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });

    // Nếu đã có BPMN XML được lưu, trả về luôn
    if (workflow.bpmn_xml) {
      res.set({
        'Content-Type': 'application/xml',
        'Content-Disposition': `attachment; filename="${workflow.name || 'workflow'}_${workflowId}.bpmn"`
      });
      return res.send(workflow.bpmn_xml);
    }

    // Nếu chưa có, generate từ activities và transitions
    const activities = await dbHelpers.all('SELECT * FROM ActivityDefinition WHERE workflow_definition_id = $1 ORDER BY id ASC', [workflowId]);
    const transitions = await dbHelpers.all(`SELECT * FROM TransitionDefinition WHERE from_activity_id IN 
            (SELECT id FROM ActivityDefinition WHERE workflow_definition_id = $1) ORDER BY id ASC`, [workflowId]);

    const bpmnXml = BPMNExporter.generateBPMN(workflow, activities, transitions);
    res.set({
      'Content-Type': 'application/xml',
      'Content-Disposition': `attachment; filename="${workflow.name || 'workflow'}_${workflowId}.bpmn"`
    });
    res.send(bpmnXml);
  } catch (e) {
    res.status(500).json({ error: `Export failed: ${e.message || String(e)}` });
  }
});

// Validate workflow definition
app.post('/api/workflows/:id/validate', async (req, res) => {
  try {
    const workflowId = Number(req.params.id);
    if (!workflowId || Number.isNaN(workflowId)) return res.status(400).json({ error: 'Invalid workflow id' });

    const activities = await dbHelpers.all('SELECT * FROM ActivityDefinition WHERE workflow_definition_id = $1', [workflowId]);
    const transitions = await dbHelpers.all(
      `SELECT * FROM TransitionDefinition WHERE from_activity_id IN 
       (SELECT id FROM ActivityDefinition WHERE workflow_definition_id = $1)`, 
      [workflowId]
    );

    const validationErrors = BPMNValidator.validateWorkflow(activities, transitions);
    const cycleErrors = BPMNValidator.detectCycles(activities, transitions);
    const allErrors = [...validationErrors, ...cycleErrors];
    
    res.json({
      isValid: allErrors.length === 0,
      errors: allErrors,
      summary: {
        totalActivities: activities.length,
        totalTransitions: transitions.length,
        startEvents: activities.filter(a => a.type === 'start').length,
        endEvents: activities.filter(a => a.type === 'end').length,
        userTasks: activities.filter(a => ['user', 'role', 'department', 'group'].includes(a.type)).length,
        serviceTasks: activities.filter(a => a.type === 'service').length,
        gateways: activities.filter(a => ['exclusiveGateway', 'parallelGateway'].includes(a.type)).length
      }
    });
  } catch (error) {
    res.status(500).json({ error: `Validation failed: ${error.message || String(error)}` });
  }
});

// Simple BPMN save endpoint - chỉ lưu XML mà không validate
app.post('/api/workflows/:id/save-bpmn-xml', [...idParamValidation, ...bpmnValidation], handleValidationErrors, async (req, res) => {
  try {
    const workflowId = Number(req.params.id);
    const { bpmnXml } = req.body || {};
    
    // Simply update the BPMN XML in database
    await dbHelpers.run(
      `UPDATE WorkflowDefinition SET bpmn_xml = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [bpmnXml, workflowId]
    );
    
    res.json({ 
      success: true, 
      message: 'BPMN XML saved successfully',
      workflowId: workflowId 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Import BPMN XML -> cập nhật ActivityDefinition + TransitionDefinition
app.post('/api/workflows/:id/import-bpmn', [...idParamValidation, ...bpmnValidation], handleValidationErrors, async (req, res) => {
  const workflowId = Number(req.params.id);
  const { bpmnXml, name, description } = req.body || {};
  if (!workflowId || Number.isNaN(workflowId)) return res.status(400).json({ error: 'Invalid workflow id' });
  if (!bpmnXml || typeof bpmnXml !== 'string') return res.status(400).json({ error: 'bpmnXml is required' });

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true
  });

  let doc;
  try {
    doc = parser.parse(bpmnXml);
  } catch (e) {
    return res.status(400).json({ error: `Invalid XML: ${e.message || String(e)}` });
  }

  // cố gắng tìm process
  const defs = doc && (doc.definitions || doc.Definitions);
  const process = defs && (defs.process || defs.Process);
  if (!process) return res.status(400).json({ error: 'No <process> found in BPMN XML' });

  const asArray = (x) => (Array.isArray(x) ? x : x ? [x] : []);

  const userTasks = asArray(process.userTask);
  const serviceTasks = asArray(process.serviceTask);
  const startEvents = asArray(process.startEvent);
  const endEvents = asArray(process.endEvent);
  const exclusiveGateways = asArray(process.exclusiveGateway);
  const parallelGateways = asArray(process.parallelGateway);
  const allElements = [...userTasks, ...serviceTasks, ...startEvents, ...endEvents, ...exclusiveGateways, ...parallelGateways];
  const flows = asArray(process.sequenceFlow);

  // map elementId -> numeric activityId
  const parseNumericSuffix = (id) => {
    const m = String(id || '').match(/(\d+)\s*$/);
    return m ? Number(m[1]) : null;
  };

  try {
    // Get next available IDs
    const maxActivityResult = await dbHelpers.get('SELECT COALESCE(MAX(id), 0) AS max_id FROM ActivityDefinition');
    let nextActivityId = (maxActivityResult?.max_id || 0) + 1;

    const maxTransitionResult = await dbHelpers.get('SELECT COALESCE(MAX(id), 0) AS max_id FROM TransitionDefinition');
    let nextTransitionId = (maxTransitionResult?.max_id || 0) + 1;

    const elementToActivityId = new Map();
    const activitiesToInsert = [];

    const detectType = (element, elementType = null) => {
      // Nếu đã biết loại element từ BPMN
      if (elementType === 'startEvent') return 'start';
      if (elementType === 'endEvent') return 'end';
      if (elementType === 'exclusiveGateway') return 'exclusiveGateway';
      if (elementType === 'parallelGateway') return 'parallelGateway';
      
      const name = (element['@_name'] || '').toLowerCase();
      if (name.startsWith('[service]')) return 'service';
      if (name.startsWith('[user]')) return 'user';
      if (name.startsWith('[role]')) return 'role';
      if (name.startsWith('[department]')) return 'department';
      if (name.startsWith('[group]')) return 'group';

      // extensionElements -> wf:type
      const ext = element.extensionElements;
      const extType =
        (ext && ext['wf:type']) ||
        (ext && ext['wf:Type']) ||
        (ext && ext.type) ||
        (ext && ext.Type);
      if (typeof extType === 'string') {
        const v = extType.toLowerCase();
        if (['service', 'user', 'role', 'department', 'group', 'start', 'end', 'exclusiveGateway', 'parallelGateway'].includes(v)) return v;
      }
      
      // Default cho serviceTask và userTask
      if (elementType === 'serviceTask') return 'service';
      return 'user';
    };

    // Xử lý từng loại element
    const processElements = [
      ...userTasks.map(t => ({ element: t, elementType: 'userTask' })),
      ...serviceTasks.map(t => ({ element: t, elementType: 'serviceTask' })),
      ...startEvents.map(t => ({ element: t, elementType: 'startEvent' })),
      ...endEvents.map(t => ({ element: t, elementType: 'endEvent' })),
      ...exclusiveGateways.map(t => ({ element: t, elementType: 'exclusiveGateway' })),
      ...parallelGateways.map(t => ({ element: t, elementType: 'parallelGateway' }))
    ];
    
    processElements.forEach(({ element, elementType }) => {
      const elementId = element['@_id'];
      const elementName = element['@_name'] || elementId || 'Element';
      const elementTypeResolved = detectType(element, elementType);

      // handler: từ extensionElements wf:handler hoặc tên dạng [service:Name] Task
      let handlerName = null;
      const ext = element.extensionElements;
      const extHandler = (ext && (ext['wf:handler'] || ext['wf:Handler'] || ext.handler || ext.Handler));
      if (typeof extHandler === 'string') handlerName = extHandler;
      if (!handlerName && elementName.toLowerCase().startsWith('[service:')) {
        const m = elementName.match(/^\[service:([^\]]+)\]/i);
        if (m && m[1]) handlerName = m[1];
      }

      // Cho phép bạn đặt id dạng Activity_10 để map trực tiếp về 10
      let actId = null;
      const numeric = parseNumericSuffix(elementId);
      if (numeric) actId = numeric;
      else actId = nextActivityId++;

      elementToActivityId.set(elementId, actId);
      activitiesToInsert.push({
        id: actId,
        workflow_definition_id: workflowId,
        name: elementName,
        type: elementTypeResolved,
        handler: handlerName
      });
    });

    const transitionsToInsert = [];
    flows.forEach((f) => {
      const fromEl = f['@_sourceRef'];
      const toEl = f['@_targetRef'];
      const flowName = f['@_name'];

      const fromId = elementToActivityId.get(fromEl);
      const toId = elementToActivityId.get(toEl);
      if (!fromId || !toId) return;

      transitionsToInsert.push({
        id: nextTransitionId++,
        from_activity_id: fromId,
        to_activity_id: toId,
        condition: flowName || 'Done'
      });
    });

    // Update WorkflowDefinition meta + bpmn_xml
    const updateResult = await dbHelpers.run(
      `UPDATE WorkflowDefinition
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           version = COALESCE(version, 0) + 1,
           bpmn_xml = $3
       WHERE id = $4`,
      [name || null, description || null, bpmnXml, workflowId]
    );

    // Nếu workflow chưa tồn tại thì tạo mới (updateResult.changes === 0 trong SQLite)
    // Với PostgreSQL, chúng ta kiểm tra xem workflow có tồn tại không
    const existingWorkflow = await dbHelpers.get('SELECT id FROM WorkflowDefinition WHERE id = $1', [workflowId]);
    if (!existingWorkflow) {
      await dbHelpers.run(
        `INSERT INTO WorkflowDefinition (id, name, version, description, bpmn_xml)
         VALUES ($1, $2, 1, $3, $4)`,
        [workflowId, name || `Workflow ${workflowId}`, description || '', bpmnXml]
      );
    }

    // Validate workflow trước khi insert
    const validationErrors = BPMNValidator.validateWorkflow(activitiesToInsert, transitionsToInsert);
    const cycleErrors = BPMNValidator.detectCycles(activitiesToInsert, transitionsToInsert);
    const allErrors = [...validationErrors, ...cycleErrors];
    
    if (allErrors.length > 0) {
      return res.status(400).json({ 
        error: 'Workflow validation failed', 
        details: allErrors 
      });
    }

    // Wipe old definitions for this workflow
    await dbHelpers.run('DELETE FROM TransitionDefinition WHERE from_activity_id IN (SELECT id FROM ActivityDefinition WHERE workflow_definition_id = $1)', [workflowId]);
    await dbHelpers.run('DELETE FROM ActivityDefinition WHERE workflow_definition_id = $1', [workflowId]);

    // Insert activities
    for (const activity of activitiesToInsert) {
      await dbHelpers.run(
        `INSERT INTO ActivityDefinition (id, workflow_definition_id, name, type, handler) VALUES ($1, $2, $3, $4, $5)`,
        [activity.id, activity.workflow_definition_id, activity.name, activity.type, activity.handler || null]
      );
    }

    // Insert transitions
    for (const transition of transitionsToInsert) {
      await dbHelpers.run(
        `INSERT INTO TransitionDefinition (id, from_activity_id, to_activity_id, condition) VALUES ($1, $2, $3, $4)`,
        [transition.id, transition.from_activity_id, transition.to_activity_id, transition.condition]
      );
    }

    res.json({
      success: true,
      workflowId,
      activities: activitiesToInsert.length,
      transitions: transitionsToInsert.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Lấy chi tiết workflow instance (activities + tasks + log)
// Khởi tạo instance mới
app.post('/api/workflow-instances/start', [
  body('workflow_definition_id').isInt({ min: 1 }).withMessage('workflow_definition_id phải là số nguyên dương'),
  body('business_id').notEmpty().withMessage('business_id không được để trống'),
  body('actorUserId').optional().isString().withMessage('actorUserId phải là chuỗi'),
  body('initial_context').optional().isObject().withMessage('initial_context phải là object')
], handleValidationErrors, async (req, res) => {
  try {
    const { workflow_definition_id, business_id, actorUserId, initial_context } = req.body || {};
    if (!workflow_definition_id) return res.status(400).json({ error: 'workflow_definition_id is required' });
    if (business_id === undefined || business_id === null) return res.status(400).json({ error: 'business_id is required' });

    // Get next instance ID
    const maxResult = await dbHelpers.get('SELECT COALESCE(MAX(id), 0) AS max_id FROM WorkflowInstance');
    const newInstanceId = (maxResult?.max_id || 0) + 1;
    
    // Create workflow instance
    const ctx = stringifyJson(initial_context || {});
    await dbHelpers.run(
      `INSERT INTO WorkflowInstance (id, workflow_definition_id, business_id, state, created_at, context_json)
       VALUES ($1, $2, $3, 'Running', CURRENT_TIMESTAMP, $4)`,
      [newInstanceId, workflow_definition_id, business_id, ctx]
    );

    // Get first activity (simplified - just get first by id)
    const firstActivity = await dbHelpers.get(
      'SELECT * FROM ActivityDefinition WHERE workflow_definition_id = $1 ORDER BY id ASC LIMIT 1',
      [workflow_definition_id]
    );
    
    if (firstActivity) {
      // Create activity instance for first activity
      const maxActivityResult = await dbHelpers.get('SELECT COALESCE(MAX(id), 0) AS max_id FROM ActivityInstance');
      const activityInstanceId = (maxActivityResult?.max_id || 0) + 1;
      
      await dbHelpers.run(
        `INSERT INTO ActivityInstance (id, workflow_instance_id, activity_definition_id, activity_name, activity_type, status, created_at)
         VALUES ($1, $2, $3, $4, $5, 'Running', CURRENT_TIMESTAMP)`,
        [activityInstanceId, newInstanceId, firstActivity.id, firstActivity.name, firstActivity.type]
      );

      // Create basic task assignment (simplified version)
      const maxTaskResult = await dbHelpers.get('SELECT COALESCE(MAX(id), 0) AS max_id FROM TaskAssignee');
      const taskId = (maxTaskResult?.max_id || 0) + 1;
      
      await dbHelpers.run(
        `INSERT INTO TaskAssignee (id, activity_instance_id, assignment_type, user_id, is_completed)
         VALUES ($1, $2, 'user', $3, false)`,
        [taskId, activityInstanceId, actorUserId || 101]
      );
    }

    res.json({
      success: true,
      workflowInstanceId: newInstanceId,
      state: 'Running',
      message: 'Workflow instance started successfully (simplified version)'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DomainLog APIs
app.get('/api/domain-logs', async (req, res) => {
  try {
    const workflowDefId = req.query && req.query.workflow_definition_id;
    const limit = Math.min(parseInt((req.query && req.query.limit) || '100', 10) || 100, 500);
    
    if (workflowDefId) {
      const sql = `
        SELECT dl.* FROM DomainLog dl
        WHERE dl.workflow_instance_id IN (
          SELECT id FROM WorkflowInstance WHERE workflow_definition_id = $1
        )
        ORDER BY dl.id DESC
        LIMIT $2
      `;
      const rows = await dbHelpers.all(sql, [workflowDefId, limit]);
      res.json(rows || []);
    } else {
      const rows = await dbHelpers.all('SELECT * FROM DomainLog ORDER BY id DESC LIMIT $1', [limit]);
      res.json(rows || []);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/workflow-instances/:id/domain-logs', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    
    const rows = await dbHelpers.all('SELECT * FROM DomainLog WHERE workflow_instance_id = $1 ORDER BY id DESC', [id]);
    res.json(rows || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/workflow-instances/:id', async (req, res) => {
  const instanceId = req.params.id;
  
  try {
    const instance = await dbHelpers.get('SELECT * FROM WorkflowInstance WHERE id = $1', [instanceId]);
    if (!instance) return res.status(404).json({ error: 'Not found' });

    const activities = await dbHelpers.all(
      `SELECT ai.*, ad.name AS activity_name, ad.type AS activity_type
       FROM ActivityInstance ai
       JOIN ActivityDefinition ad ON ai.activity_definition_id = ad.id
       WHERE ai.workflow_instance_id = $1
       ORDER BY ai.created_at ASC`,
      [instanceId]
    );

    const tasks = await dbHelpers.all(
      `SELECT ta.*, ad.name AS activity_name
       FROM TaskAssignee ta
       JOIN ActivityInstance ai ON ta.activity_instance_id = ai.id
       JOIN ActivityDefinition ad ON ai.activity_definition_id = ad.id
       WHERE ai.workflow_instance_id = $1
       ORDER BY ta.id ASC`,
      [instanceId]
    );

    const logs = await dbHelpers.all(
      `SELECT tl.*, ai.workflow_instance_id
       FROM TransitionLog tl
       JOIN ActivityInstance ai ON tl.from_activity_instance_id = ai.id
       WHERE ai.workflow_instance_id = $1
       ORDER BY tl.created_at ASC`,
      [instanceId]
    );

    res.json({ 
      instance, 
      activities, 
      tasks, 
      logs, 
      context: safeParseJson(instance && instance.context_json) 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Complete 1 task + đánh dấu activity done + tự chuyển bước theo TransitionDefinition
app.post('/api/tasks/:taskId/complete', [
  param('taskId').notEmpty().withMessage('taskId không được để trống'),
  body('condition').optional().isIn(['Done', 'Approved', 'Rejected']).withMessage('condition phải là Done, Approved hoặc Rejected'),
  body('actorUserId').notEmpty().withMessage('actorUserId không được để trống'),
  body('contextPatch').optional().isObject().withMessage('contextPatch phải là object')
], handleValidationErrors, async (req, res) => {
  const taskId = req.params.taskId;
  const condition = (req.body && req.body.condition) || 'Done'; // Done | Approved | Rejected
  const actorUserId = req.body && req.body.actorUserId;
  const contextPatch = (req.body && req.body.contextPatch) || null;

  if (!actorUserId) return res.status(400).json({ error: 'actorUserId is required' });

  try {
    // 1) Lấy task + activity instance đang chạy
    const taskRow = await dbHelpers.get(
      `SELECT ta.*, ai.workflow_instance_id, ai.activity_definition_id
       FROM TaskAssignee ta
       JOIN ActivityInstance ai ON ta.activity_instance_id = ai.id
       WHERE ta.id = $1`,
      [taskId]
    );
    if (!taskRow) return res.status(404).json({ error: 'Task not found' });
    if (taskRow.is_completed) return res.status(409).json({ error: 'Task already completed' });

    // Simplified completion for now - just mark as completed
    await dbHelpers.run('UPDATE TaskAssignee SET is_completed = true WHERE id = $1', [taskId]);
    
    res.json({ 
      success: true, 
      message: 'Task completed successfully (simplified version)',
      taskId: taskId 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// --- CRUD APIs cho Workflow Management ---

// POST /api/workflows - Tạo workflow definition mới
app.post('/api/workflows', workflowValidation, handleValidationErrors, async (req, res) => {
  try {
    const { name, description, version } = req.body || {};

    const maxResult = await dbHelpers.get('SELECT COALESCE(MAX(id), 0) AS max_id FROM WorkflowDefinition');
    const newId = (maxResult?.max_id || 0) + 1;

    await dbHelpers.run(
      `INSERT INTO WorkflowDefinition (id, name, version, description, created_at, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [newId, name.trim(), version || 1, description?.trim() || null]
    );
    
    res.json({ id: newId, name: name.trim(), version: version || 1, description: description?.trim() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/workflows/:id - Cập nhật workflow definition
app.put('/api/workflows/:id', [...idParamValidation, ...workflowValidation], handleValidationErrors, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, description, version } = req.body || {};

    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name.trim());
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description?.trim() || null);
    }
    if (version !== undefined) {
      updates.push(`version = $${paramIndex++}`);
      values.push(version);
    }
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    if (updates.length === 1) return res.status(400).json({ error: 'No fields to update' });

    const result = await dbHelpers.runWithId(
      `UPDATE WorkflowDefinition SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values
    );
    
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    
    const updatedRow = await dbHelpers.get('SELECT * FROM WorkflowDefinition WHERE id = $1', [id]);
    res.json(updatedRow);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/workflows/:id - Xóa workflow definition (cascade xóa activities/transitions)
app.delete('/api/workflows/:id', idParamValidation, handleValidationErrors, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    // Delete transitions first (foreign key constraint)
    await dbHelpers.run('DELETE FROM TransitionDefinition WHERE from_activity_id IN (SELECT id FROM ActivityDefinition WHERE workflow_definition_id = $1)', [id]);
    
    // Delete activities
    await dbHelpers.run('DELETE FROM ActivityDefinition WHERE workflow_definition_id = $1', [id]);
    
    // Delete workflow
    const result = await dbHelpers.runWithId('DELETE FROM WorkflowDefinition WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    
    res.json({ success: true, deletedId: id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/workflows/:id/activities - Danh sách activities của 1 workflow
// Cập nhật context của 1 workflow instance
app.put('/api/workflow-instances/:id/context', [
  ...idParamValidation,
  body('contextPatch').isObject().withMessage('contextPatch phải là object')
], handleValidationErrors, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const patch = (req.body && req.body.contextPatch) || {};
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    if (typeof patch !== 'object') return res.status(400).json({ error: 'contextPatch must be an object' });

    const row = await dbHelpers.get('SELECT context_json FROM WorkflowInstance WHERE id = $1', [id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    
    const ctx = safeParseJson(row.context_json);
    const merged = { ...ctx, ...patch };
    
    await dbHelpers.run('UPDATE WorkflowInstance SET context_json = $1 WHERE id = $2', [stringifyJson(merged), id]);
    res.json({ id, context: merged });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/workflows/:id/activities', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const rows = await dbHelpers.all('SELECT * FROM ActivityDefinition WHERE workflow_definition_id = $1 ORDER BY id ASC', [id]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/workflows/:id/activities - Tạo activity definition mới
app.post('/api/workflows/:id/activities', [...idParamValidation, ...activityValidation], handleValidationErrors, async (req, res) => {
  try {
    const workflowId = Number(req.params.id);
    const { name, type, handler } = req.body || {};

    const maxResult = await dbHelpers.get('SELECT COALESCE(MAX(id), 0) AS max_id FROM ActivityDefinition');
    const newId = (maxResult?.max_id || 0) + 1;

    await dbHelpers.run(
      `INSERT INTO ActivityDefinition (id, workflow_definition_id, name, type, handler)
       VALUES ($1, $2, $3, $4, $5)`,
      [newId, workflowId, name.trim(), type || 'user', handler?.trim() || null]
    );
    
    res.json({ 
      id: newId, 
      workflow_definition_id: workflowId,
      name: name.trim(), 
      type: type || 'user', 
      handler: handler?.trim() || null 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/activities/:id - Cập nhật activity definition
app.put('/api/activities/:id', [...idParamValidation, ...activityValidation], handleValidationErrors, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, type, handler } = req.body || {};
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (type !== undefined) {
      updates.push(`type = $${paramIndex++}`);
      values.push(type);
    }
    if (handler !== undefined) {
      updates.push(`handler = $${paramIndex++}`);
      values.push(handler);
    }
    values.push(id);

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    const result = await dbHelpers.runWithId(`UPDATE ActivityDefinition SET ${updates.join(', ')} WHERE id = $${paramIndex}`, values);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    
    const updatedRow = await dbHelpers.get('SELECT * FROM ActivityDefinition WHERE id = $1', [id]);
    res.json(updatedRow);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/activities/:id - Xóa activity definition (cascade xóa transitions)
app.delete('/api/activities/:id', idParamValidation, handleValidationErrors, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    // Delete transitions first (foreign key constraint)
    await dbHelpers.run('DELETE FROM TransitionDefinition WHERE from_activity_id = $1 OR to_activity_id = $1', [id]);
    
    // Delete activity
    const result = await dbHelpers.runWithId('DELETE FROM ActivityDefinition WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Activity not found' });
    }
    
    res.json({ success: true, deletedId: id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/workflows/:id/transitions - Danh sách transitions của 1 workflow
app.get('/api/workflows/:id/transitions', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const rows = await dbHelpers.all(
      `SELECT td.*
       FROM TransitionDefinition td
       WHERE td.from_activity_id IN (SELECT id FROM ActivityDefinition WHERE workflow_definition_id = $1)
       ORDER BY td.id ASC`,
      [id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/workflows/:id/transitions - Tạo transition definition mới
app.post('/api/workflows/:id/transitions', [...idParamValidation, ...transitionValidation], handleValidationErrors, async (req, res) => {
  try {
    const workflowId = Number(req.params.id);
    const { from_activity_id, to_activity_id, condition, priority, is_default } = req.body || {};
    if (Number.isNaN(workflowId)) return res.status(400).json({ error: 'Invalid workflow id' });
    if (!from_activity_id || !to_activity_id) return res.status(400).json({ error: 'from_activity_id and to_activity_id are required' });

    // Verify activities belong to this workflow
    const verifyResult = await dbHelpers.get(
      `SELECT COUNT(*) AS cnt FROM ActivityDefinition WHERE id IN ($1, $2) AND workflow_definition_id = $3`,
      [from_activity_id, to_activity_id, workflowId]
    );
    if (!verifyResult || verifyResult.cnt !== 2) {
      return res.status(400).json({ error: 'Activities must belong to this workflow' });
    }

    // Get next transition ID
    const maxResult = await dbHelpers.get('SELECT COALESCE(MAX(id), 0) AS max_id FROM TransitionDefinition');
    const newId = (maxResult?.max_id || 0) + 1;

    // Insert new transition
    await dbHelpers.run(
      `INSERT INTO TransitionDefinition (id, from_activity_id, to_activity_id, condition, priority, is_default)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [newId, from_activity_id, to_activity_id, condition || 'Done', Number.isFinite(priority) ? priority : null, is_default ? true : false]
    );

    res.json({ 
      id: newId, 
      from_activity_id, 
      to_activity_id, 
      condition: condition || 'Done', 
      priority: Number.isFinite(priority) ? priority : null, 
      is_default: is_default ? true : false 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/transitions/:id - Cập nhật transition definition
app.put('/api/transitions/:id', [...idParamValidation, ...transitionValidation], handleValidationErrors, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { from_activity_id, to_activity_id, condition, priority, is_default } = req.body || {};
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (from_activity_id !== undefined) {
      updates.push(`from_activity_id = $${paramIndex++}`);
      values.push(from_activity_id);
    }
    if (to_activity_id !== undefined) {
      updates.push(`to_activity_id = $${paramIndex++}`);
      values.push(to_activity_id);
    }
    if (condition !== undefined) {
      updates.push(`condition = $${paramIndex++}`);
      values.push(condition);
    }
    if (priority !== undefined) {
      updates.push(`priority = $${paramIndex++}`);
      values.push(priority);
    }
    if (is_default !== undefined) {
      updates.push(`is_default = $${paramIndex++}`);
      values.push(is_default);
    }
    values.push(id);

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    const result = await dbHelpers.runWithId(`UPDATE TransitionDefinition SET ${updates.join(', ')} WHERE id = $${paramIndex}`, values);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    
    const updatedRow = await dbHelpers.get('SELECT * FROM TransitionDefinition WHERE id = $1', [id]);
    res.json(updatedRow);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/transitions/:id - Xóa transition definition
app.delete('/api/transitions/:id', idParamValidation, handleValidationErrors, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const result = await dbHelpers.runWithId('DELETE FROM TransitionDefinition WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Transition not found' });
    }
    
    res.json({ success: true, deletedId: id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve static React build (prefer frontend/build, fallback to backend/build)
const FE_BUILD_DIR = path.resolve(__dirname, '../frontend/build');
const BE_BUILD_DIR = path.join(__dirname, 'build');
const STATIC_DIR = fs.existsSync(FE_BUILD_DIR) ? FE_BUILD_DIR : (fs.existsSync(BE_BUILD_DIR) ? BE_BUILD_DIR : null);

if (STATIC_DIR) {
  app.use(express.static(STATIC_DIR));
  // Fallback cho React Router - sử dụng regex thay vì *
  app.get(/^(?!\/api\/).*$/, (req, res) => {
    res.sendFile(path.join(STATIC_DIR, 'index.html'));
  });
} else {
  // Nếu chưa build FE, trả lời hướng dẫn
  app.get(/.*/, (req, res) => {
    res.status(200).send(
      'Frontend build not found. Run "npm run build" in frontend, or start the frontend dev server at http://localhost:3000.'
    );
  });
}

const PORT = 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
