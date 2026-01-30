-- PostgreSQL Schema Migration from SQLite
-- Run this script to create all tables and indexes in PostgreSQL

-- Enable extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Workflow definition
CREATE TABLE IF NOT EXISTS WorkflowDefinition (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    version INTEGER,
    description TEXT,
    bpmn_xml TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Performance indexes for WorkflowDefinition
CREATE INDEX IF NOT EXISTS idx_workflow_name ON WorkflowDefinition(name);
CREATE INDEX IF NOT EXISTS idx_workflow_version ON WorkflowDefinition(version);
CREATE INDEX IF NOT EXISTS idx_workflow_created ON WorkflowDefinition(created_at);

-- Activity definition
CREATE TABLE IF NOT EXISTS ActivityDefinition (
    id SERIAL PRIMARY KEY,
    workflow_definition_id INTEGER REFERENCES WorkflowDefinition(id) ON DELETE CASCADE,
    name VARCHAR(255),
    type VARCHAR(100),
    handler VARCHAR(255)
);

-- Activity indexes
CREATE INDEX IF NOT EXISTS idx_activity_workflow ON ActivityDefinition(workflow_definition_id);
CREATE INDEX IF NOT EXISTS idx_activity_type ON ActivityDefinition(type);
CREATE INDEX IF NOT EXISTS idx_activity_handler ON ActivityDefinition(handler);

-- Transition definition
CREATE TABLE IF NOT EXISTS TransitionDefinition (
    id SERIAL PRIMARY KEY,
    from_activity_id INTEGER REFERENCES ActivityDefinition(id) ON DELETE CASCADE,
    to_activity_id INTEGER REFERENCES ActivityDefinition(id) ON DELETE CASCADE,
    condition VARCHAR(255),
    priority INTEGER,
    is_default BOOLEAN DEFAULT FALSE
);

-- Transition indexes
CREATE INDEX IF NOT EXISTS idx_transition_from ON TransitionDefinition(from_activity_id);
CREATE INDEX IF NOT EXISTS idx_transition_to ON TransitionDefinition(to_activity_id);
CREATE INDEX IF NOT EXISTS idx_transition_priority ON TransitionDefinition(priority);

-- Org structure
CREATE TABLE IF NOT EXISTS "Group" (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS GroupMember (
    id SERIAL PRIMARY KEY,
    group_id INTEGER REFERENCES "Group"(id) ON DELETE CASCADE,
    user_id INTEGER,
    UNIQUE(group_id, user_id)
);

-- Workflow instance
CREATE TABLE IF NOT EXISTS WorkflowInstance (
    id SERIAL PRIMARY KEY,
    workflow_definition_id INTEGER REFERENCES WorkflowDefinition(id) ON DELETE CASCADE,
    state VARCHAR(50),
    business_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Instance indexes
CREATE INDEX IF NOT EXISTS idx_instance_workflow ON WorkflowInstance(workflow_definition_id);
CREATE INDEX IF NOT EXISTS idx_instance_state ON WorkflowInstance(state);
CREATE INDEX IF NOT EXISTS idx_instance_business ON WorkflowInstance(business_id);

-- Activity instance
CREATE TABLE IF NOT EXISTS ActivityInstance (
    id SERIAL PRIMARY KEY,
    workflow_instance_id INTEGER REFERENCES WorkflowInstance(id) ON DELETE CASCADE,
    activity_definition_id INTEGER REFERENCES ActivityDefinition(id) ON DELETE CASCADE,
    activity_name VARCHAR(255),
    activity_type VARCHAR(100),
    status VARCHAR(50),
    assignee_user_id INTEGER,
    assignee_group_id INTEGER REFERENCES "Group"(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Activity instance indexes
CREATE INDEX IF NOT EXISTS idx_activity_instance_workflow ON ActivityInstance(workflow_instance_id);
CREATE INDEX IF NOT EXISTS idx_activity_instance_definition ON ActivityInstance(activity_definition_id);
CREATE INDEX IF NOT EXISTS idx_activity_instance_status ON ActivityInstance(status);
CREATE INDEX IF NOT EXISTS idx_activity_instance_assignee_user ON ActivityInstance(assignee_user_id);

-- Transition log
CREATE TABLE IF NOT EXISTS TransitionLog (
    id SERIAL PRIMARY KEY,
    from_activity_instance_id INTEGER REFERENCES ActivityInstance(id) ON DELETE CASCADE,
    to_activity_instance_id INTEGER REFERENCES ActivityInstance(id) ON DELETE CASCADE,
    condition VARCHAR(255),
    acted_by_user_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Transition log indexes
CREATE INDEX IF NOT EXISTS idx_transition_log_from ON TransitionLog(from_activity_instance_id);
CREATE INDEX IF NOT EXISTS idx_transition_log_to ON TransitionLog(to_activity_instance_id);
CREATE INDEX IF NOT EXISTS idx_transition_log_user ON TransitionLog(acted_by_user_id);

-- Outbox pattern for reliable messaging
CREATE TABLE IF NOT EXISTS OutboxEvent (
    id SERIAL PRIMARY KEY,
    aggregate_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING',
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Outbox indexes
CREATE INDEX IF NOT EXISTS idx_outbox_aggregate ON OutboxEvent(aggregate_id);
CREATE INDEX IF NOT EXISTS idx_outbox_status ON OutboxEvent(status);
CREATE INDEX IF NOT EXISTS idx_outbox_next_retry ON OutboxEvent(next_retry_at);
CREATE INDEX IF NOT EXISTS idx_outbox_created ON OutboxEvent(created_at);

-- Auto-update updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at
CREATE TRIGGER update_workflow_definition_updated_at BEFORE UPDATE ON WorkflowDefinition FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_workflow_instance_updated_at BEFORE UPDATE ON WorkflowInstance FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_activity_instance_updated_at BEFORE UPDATE ON ActivityInstance FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_outbox_event_updated_at BEFORE UPDATE ON OutboxEvent FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data (equivalent to the seed data)
INSERT INTO WorkflowDefinition (id, name, version, description, created_at, updated_at) 
VALUES (1, 'Basic Approval Flow', 1, 'A basic approval workflow', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

INSERT INTO ActivityDefinition (id, workflow_definition_id, name, type, handler) VALUES
(1, 1, 'Tạo yêu cầu', 'UserTask', 'create_request'),
(2, 1, 'Xem xét đề xuất', 'UserTask', 'review_proposal'),
(3, 1, 'Phê duyệt', 'UserTask', 'approve'),
(4, 1, 'Hoàn thành', 'ServiceTask', 'complete')
ON CONFLICT (id) DO NOTHING;

INSERT INTO TransitionDefinition (id, from_activity_id, to_activity_id, condition, priority, is_default) VALUES
(1, 1, 2, 'Done', 1, TRUE),
(2, 2, 3, 'Approved', 1, FALSE),
(3, 2, 1, 'Rejected', 2, FALSE),
(4, 3, 4, 'Done', 1, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO "Group" (id, name, start_date, end_date) VALUES
(1, 'Reviewers', CURRENT_TIMESTAMP, NULL),
(2, 'Approvers', CURRENT_TIMESTAMP, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO GroupMember (group_id, user_id) VALUES
(1, 102),  -- Trần B is reviewer
(2, 103)   -- Lê C is approver
ON CONFLICT (group_id, user_id) DO NOTHING;

-- Reset sequences to match inserted data (if they exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'workflowdefinition_id_seq') THEN
        PERFORM setval('workflowdefinition_id_seq', (SELECT COALESCE(MAX(id), 1) FROM WorkflowDefinition), true);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'activitydefinition_id_seq') THEN
        PERFORM setval('activitydefinition_id_seq', (SELECT COALESCE(MAX(id), 1) FROM ActivityDefinition), true);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'transitiondefinition_id_seq') THEN
        PERFORM setval('transitiondefinition_id_seq', (SELECT COALESCE(MAX(id), 1) FROM TransitionDefinition), true);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'Group_id_seq') THEN
        PERFORM setval('Group_id_seq', (SELECT COALESCE(MAX(id), 1) FROM "Group"), true);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'groupmember_id_seq') THEN
        PERFORM setval('groupmember_id_seq', (SELECT COALESCE(MAX(id), 1) FROM GroupMember), true);
    END IF;
END $$;