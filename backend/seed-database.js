require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function seedDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 COMPLETE DATABASE SEEDING STARTED\n');
    
    // ===== CREATE ALL TABLES =====
    console.log('📋 Creating all tables...');
    
    // Core workflow tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS WorkflowDefinition (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255),
          version INTEGER,
          description TEXT,
          bpmn_xml TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS ActivityDefinition (
          id SERIAL PRIMARY KEY,
          workflow_definition_id INTEGER REFERENCES WorkflowDefinition(id) ON DELETE CASCADE,
          name VARCHAR(255),
          type VARCHAR(100),
          handler VARCHAR(255)
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS TransitionDefinition (
          id SERIAL PRIMARY KEY,
          from_activity_id INTEGER REFERENCES ActivityDefinition(id) ON DELETE CASCADE,
          to_activity_id INTEGER REFERENCES ActivityDefinition(id) ON DELETE CASCADE,
          condition VARCHAR(255),
          priority INTEGER,
          is_default BOOLEAN DEFAULT FALSE
      )
    `);
    
    // Organization tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS "Group" (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255),
          start_date TIMESTAMP WITH TIME ZONE,
          end_date TIMESTAMP WITH TIME ZONE
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS GroupMember (
          id SERIAL PRIMARY KEY,
          group_id INTEGER REFERENCES "Group"(id) ON DELETE CASCADE,
          user_id INTEGER,
          UNIQUE(group_id, user_id)
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS Role (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255)
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS Department (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255)
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS "User" (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255),
          department_id INTEGER REFERENCES Department(id),
          role_id INTEGER REFERENCES Role(id)
      )
    `);
    
    // Runtime tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS WorkflowInstance (
          id SERIAL PRIMARY KEY,
          workflow_definition_id INTEGER REFERENCES WorkflowDefinition(id) ON DELETE CASCADE,
          state VARCHAR(50),
          business_id VARCHAR(255),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await client.query(`
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
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS TaskAssignee (
          id SERIAL PRIMARY KEY,
          activity_instance_id INTEGER REFERENCES ActivityInstance(id),
          assignment_type VARCHAR(50),
          group_id INTEGER REFERENCES "Group"(id),
          user_id INTEGER,
          role_id INTEGER REFERENCES Role(id),
          department_id INTEGER REFERENCES Department(id),
          is_completed BOOLEAN DEFAULT FALSE
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS TransitionLog (
          id SERIAL PRIMARY KEY,
          from_activity_instance_id INTEGER REFERENCES ActivityInstance(id) ON DELETE CASCADE,
          to_activity_instance_id INTEGER REFERENCES ActivityInstance(id) ON DELETE CASCADE,
          condition VARCHAR(255),
          acted_by_user_id INTEGER,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Outbox pattern
    await client.query(`
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
      )
    `);
    
    // Domain logging table  
    await client.query(`
      CREATE TABLE IF NOT EXISTS DomainLog (
          id SERIAL PRIMARY KEY,
          workflow_instance_id INTEGER REFERENCES WorkflowInstance(id) ON DELETE CASCADE,
          activity_definition_id INTEGER REFERENCES ActivityDefinition(id) ON DELETE CASCADE,
          action VARCHAR(255) NOT NULL,
          metadata_json TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ All tables created successfully');
    
    // ===== CREATE INDEXES =====
    console.log('\n📊 Creating performance indexes...');
    
    // DomainLog indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_domainlog_workflow ON DomainLog(workflow_instance_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_domainlog_activity ON DomainLog(activity_definition_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_domainlog_action ON DomainLog(action)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_domainlog_created ON DomainLog(created_at)`);
    
    console.log('✅ All indexes created successfully');
    
    // ===== INSERT ALL DATA =====
    console.log('\n📝 Inserting all seed data...');
    
    // Roles
    await client.query(`
      INSERT INTO Role (id, name) VALUES 
      (1, 'Giám đốc'), (2, 'Trưởng phòng'), (3, 'Nhân viên')
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
    `);
    
    // Departments
    await client.query(`
      INSERT INTO Department (id, name) VALUES 
      (10, 'Phòng Tài chính'), (20, 'Phòng Văn thư')
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
    `);
    
    // Users
    await client.query(`
      INSERT INTO "User" (id, name, department_id, role_id) VALUES
      (101, 'Nguyễn A', 10, 3),
      (102, 'Trần B', 20, 2), 
      (103, 'Lê C', 20, 1)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        department_id = EXCLUDED.department_id,
        role_id = EXCLUDED.role_id
    `);
    
    // WorkflowDefinition
    await client.query(`
      INSERT INTO WorkflowDefinition (id, name, version, description, created_at, updated_at) 
      VALUES (1, 'Quy trình phê duyệt văn bản', 1, 'Soạn thảo -> Phân loại -> Phê duyệt -> Lưu trữ', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET 
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        updated_at = EXCLUDED.updated_at
    `);
    
    // ActivityDefinition - Both original and SQLite-style data
    await client.query(`
      INSERT INTO ActivityDefinition (id, workflow_definition_id, name, type, handler) VALUES
      (1, 1, 'Tạo yêu cầu', 'UserTask', 'create_request'),
      (2, 1, 'Xem xét đề xuất', 'UserTask', 'review_proposal'),
      (3, 1, 'Phê duyệt', 'UserTask', 'approve'),
      (4, 1, 'Hoàn thành', 'ServiceTask', 'complete'),
      (10, 1, 'Soạn thảo', 'user', null),
      (11, 1, 'Phân loại', 'department', null),
      (12, 1, 'Phê duyệt', 'role', null),
      (13, 1, 'Lưu trữ', 'department', null)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        type = EXCLUDED.type,
        handler = EXCLUDED.handler
    `);
    
    // TransitionDefinition - Both original and SQLite-style data
    await client.query(`
      INSERT INTO TransitionDefinition (id, from_activity_id, to_activity_id, condition, priority, is_default) VALUES
      (1, 1, 2, 'Done', 1, TRUE),
      (2, 2, 3, 'Approved', 1, FALSE),
      (3, 2, 1, 'Rejected', 2, FALSE),
      (4, 3, 4, 'Done', 1, TRUE),
      (100, 10, 11, 'Done', 1, TRUE),
      (101, 11, 12, 'Done', 1, TRUE),
      (102, 12, 13, 'Approved', 1, FALSE),
      (103, 12, 10, 'Rejected', 2, FALSE)
      ON CONFLICT (id) DO UPDATE SET
        condition = EXCLUDED.condition,
        priority = EXCLUDED.priority,
        is_default = EXCLUDED.is_default
    `);
    
    // Groups
    await client.query(`
      INSERT INTO "Group" (id, name, start_date, end_date) VALUES
      (1, 'Reviewers', CURRENT_TIMESTAMP, NULL),
      (2, 'Approvers', CURRENT_TIMESTAMP, NULL),
      (50, 'Nhóm dự án ERP', '2026-01-01', '2026-03-31')
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date
    `);
    
    // GroupMembers
    await client.query(`
      INSERT INTO GroupMember (id, group_id, user_id) VALUES
      (1, 50, 101), (2, 50, 102), (3, 50, 103),
      (4, 1, 102), (5, 2, 103)
      ON CONFLICT (id) DO UPDATE SET
        group_id = EXCLUDED.group_id,
        user_id = EXCLUDED.user_id
    `);
    
    // WorkflowInstance
    await client.query(`
      INSERT INTO WorkflowInstance (id, workflow_definition_id, business_id, state, created_at)
      VALUES (200, 1, '5000', 'Running', CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        state = EXCLUDED.state,
        updated_at = CURRENT_TIMESTAMP
    `);
    
    // ActivityInstances  
    await client.query(`
      INSERT INTO ActivityInstance (id, workflow_instance_id, activity_definition_id, activity_name, activity_type, status, created_at) VALUES
      (300, 200, 10, 'Soạn thảo', 'user', 'Completed', CURRENT_TIMESTAMP),
      (301, 200, 11, 'Phân loại', 'department', 'Completed', CURRENT_TIMESTAMP),
      (302, 200, 12, 'Phê duyệt', 'role', 'Running', CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
    `);
    
    // TaskAssignee
    await client.query(`
      INSERT INTO TaskAssignee (id, activity_instance_id, assignment_type, group_id, is_completed)
      VALUES (400, 302, 'group', 50, false)
      ON CONFLICT (id) DO UPDATE SET
        is_completed = EXCLUDED.is_completed
    `);
    
    console.log('✅ All seed data inserted successfully');
    
    // ===== VERIFICATION =====
    console.log('\n🔍 Verifying seeded data...');
    
    const counts = await Promise.all([
      client.query('SELECT COUNT(*) as count FROM WorkflowDefinition'),
      client.query('SELECT COUNT(*) as count FROM ActivityDefinition'), 
      client.query('SELECT COUNT(*) as count FROM TransitionDefinition'),
      client.query('SELECT COUNT(*) as count FROM "Group"'),
      client.query('SELECT COUNT(*) as count FROM GroupMember'),
      client.query('SELECT COUNT(*) as count FROM Role'),
      client.query('SELECT COUNT(*) as count FROM Department'),
      client.query('SELECT COUNT(*) as count FROM "User"'),
      client.query('SELECT COUNT(*) as count FROM WorkflowInstance'),
      client.query('SELECT COUNT(*) as count FROM ActivityInstance'),
      client.query('SELECT COUNT(*) as count FROM TaskAssignee')
    ]);
    
    console.log('\n📊 DATA SEEDING SUMMARY:');
    console.log(`   ✅ WorkflowDefinitions: ${counts[0].rows[0].count} records`);
    console.log(`   ✅ ActivityDefinitions: ${counts[1].rows[0].count} records`);
    console.log(`   ✅ TransitionDefinitions: ${counts[2].rows[0].count} records`);
    console.log(`   ✅ Groups: ${counts[3].rows[0].count} records`);
    console.log(`   ✅ GroupMembers: ${counts[4].rows[0].count} records`);
    console.log(`   ✅ Roles: ${counts[5].rows[0].count} records`);
    console.log(`   ✅ Departments: ${counts[6].rows[0].count} records`);
    console.log(`   ✅ Users: ${counts[7].rows[0].count} records`);
    console.log(`   ✅ WorkflowInstances: ${counts[8].rows[0].count} records`);
    console.log(`   ✅ ActivityInstances: ${counts[9].rows[0].count} records`);
    console.log(`   ✅ TaskAssignees: ${counts[10].rows[0].count} records`);
    
    console.log('\n🎉 DATABASE SEEDING COMPLETED SUCCESSFULLY!');
    console.log('🚀 Ready to run workflow application!');
    
  } catch (error) {
    console.error('❌ Database seeding failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run seeding
seedDatabase().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});