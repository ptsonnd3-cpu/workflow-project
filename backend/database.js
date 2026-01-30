const { Pool } = require('pg');

// PostgreSQL connection configuration
// Support both DATABASE_URL (for deployment) and individual config (for local dev)
const dbConfig = process.env.DATABASE_URL 
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false // Required for Render.com and most cloud providers
      }
    }
  : {
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'workflow_db',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    };

// Add connection pool settings
const poolConfig = {
  ...dbConfig,
  max: 20, // maximum number of clients
  idleTimeoutMillis: 30000, // close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // return an error after 10 seconds if connection could not be established
};

// Create connection pool
const pool = new Pool(poolConfig);

// Error handling for pool
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Helper functions to wrap pool methods
const db = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  end: () => pool.end(),
  
  // Helper method for transactions
  transaction: async (callback) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Method to run multiple queries in series (similar to sqlite serialize)
  serialize: async (callback) => {
    const client = await pool.connect();
    try {
      return await callback(client);
    } finally {
      client.release();
    }
  }
};

// Test connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Connected to PostgreSQL database successfully');
    console.log('🌐 Database host:', process.env.DATABASE_URL ? 'Render.com (via DATABASE_URL)' : (process.env.DB_HOST || 'localhost'));
    
    const result = await client.query('SELECT NOW()');
    console.log('📅 Database time:', result.rows[0].now);
    
    client.release();
  } catch (err) {
    console.error('❌ Database connection error:', err.message);
    console.error('💡 Connection details:');
    console.error('   DATABASE_URL:', process.env.DATABASE_URL ? '✓ Set' : '✗ Not set');
    console.error('   DB_HOST:', process.env.DB_HOST || 'localhost');
    console.error('   DB_NAME:', process.env.DB_NAME || 'workflow_db');
    console.error('   SSL:', process.env.DB_SSL || (process.env.DATABASE_URL ? 'enabled' : 'disabled'));
  }
};

module.exports = { db, testConnection };