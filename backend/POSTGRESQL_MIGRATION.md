# PostgreSQL Migration Guide 🐘

## 📋 **Prerequisites**

1. **Install PostgreSQL** (version 12+)
   - Windows: Download from https://www.postgresql.org/download/windows/
   - macOS: `brew install postgresql`
   - Linux: `sudo apt-get install postgresql postgresql-contrib`

2. **Start PostgreSQL service**
   ```bash
   # Windows
   net start postgresql-x64-16

   # macOS/Linux
   sudo systemctl start postgresql
   # or
   brew services start postgresql
   ```

## ⚙️ **Database Setup**

### 1. Create Database and User

```sql
-- Connect as postgres user
psql -U postgres

-- Create database
CREATE DATABASE workflow_db;

-- Create user (optional - for production)
CREATE USER workflow_user WITH ENCRYPTED PASSWORD 'secure_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE workflow_db TO workflow_user;

-- Connect to the new database
\c workflow_db

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO workflow_user;
```

### 2. Run Migration Script

```bash
# Single command to setup everything
node seed-database.js
```

This will:
- Create all required tables
- Insert all seed data (users, roles, workflows, etc.)
- Verify data integrity
- Report completion status

## 🔧 **Environment Configuration**

### 1. Create `.env` file in backend folder:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=workflow_db
DB_USER=postgres
DB_PASSWORD=your_postgres_password

# Server Configuration
PORT=5000
NODE_ENV=development

# CORS Configuration
CORS_ORIGIN=http://localhost:3000,https://ptsonnd3-cpu.github.io
```

### 2. Install dotenv package:

```bash
cd backend
npm install dotenv
```

### 3. Update index.js to load environment variables:

Add at the top of `backend/index.js`:
```javascript
require('dotenv').config();
```

## 🚀 **Running the Application**

### 1. Start Backend:
```bash
cd backend
npm start
```

### 2. Check Connection:
- Look for "✅ Connected to PostgreSQL database successfully" in console
- Visit: http://localhost:5000/health

### 3. Start Frontend:
```bash
cd frontend
npm start
```

## 📊 **Production Deployment**

### Cloud PostgreSQL Options:

1. **Railway**: https://railway.app (Free tier available)
2. **Supabase**: https://supabase.com (Free PostgreSQL)
3. **Heroku Postgres**: https://www.heroku.com/postgres
4. **AWS RDS**: https://aws.amazon.com/rds/
5. **Google Cloud SQL**: https://cloud.google.com/sql

### Environment Variables for Production:

```env
DB_HOST=your-postgres-host.com
DB_PORT=5432
DB_NAME=workflow_db
DB_USER=your_user
DB_PASSWORD=your_secure_password
DB_SSL=true
NODE_ENV=production
```

## 🔍 **Troubleshooting**

### Common Issues:

1. **Connection refused**
   - Check if PostgreSQL is running: `sudo systemctl status postgresql`
   - Verify connection settings in .env file

2. **Authentication failed**
   - Check username/password in .env
   - Verify user exists: `psql -U postgres -c "\du"`

3. **Database does not exist**
   - Create database: `createdb -U postgres workflow_db`

4. **Permission denied**
   - Grant privileges: `GRANT ALL PRIVILEGES ON DATABASE workflow_db TO your_user;`

### Debug Commands:

```bash
# Test connection
psql -U postgres -h localhost -p 5432 -d workflow_db

# List databases
\l

# List tables
\dt

# Check table structure
\d WorkflowDefinition
```

## 🎯 **Migration Benefits**

✅ **Scalability**: Better performance for large datasets  
✅ **ACID Compliance**: Full transaction support  
✅ **Advanced Features**: JSON columns, triggers, functions  
✅ **Production Ready**: Enterprise-grade reliability  
✅ **Cloud Support**: Easy deployment to cloud platforms  

## 📝 **Next Steps**

After successful migration:
1. Test all workflow operations
2. Verify data integrity
3. Update deployment scripts
4. Monitor performance
5. Setup backups

---

🎉 **Migration Complete!** Your workflow system now runs on PostgreSQL!