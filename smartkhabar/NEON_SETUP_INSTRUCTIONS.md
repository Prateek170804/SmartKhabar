# Neon.tech Database Setup Guide

Complete step-by-step guide to set up your free PostgreSQL database with Neon.tech.

## Your API Keys (Already Added)
✅ **GNews API**: `[YOUR_GNEWS_API_KEY]`  
✅ **Hugging Face**: `[YOUR_HUGGINGFACE_API_KEY]`  
🔄 **Neon Database**: Follow steps below

## Step 1: Create Neon Account

1. **Go to [neon.tech](https://neon.tech/)**
2. **Click "Sign Up"** (top right)
3. **Choose sign-up method:**
   - **GitHub** (recommended - faster)
   - **Google**
   - **Email**

## Step 2: Create Your Project

1. **After signing in, click "Create Project"**
2. **Fill in project details:**
   - **Project Name**: `smartkhabar`
   - **Database Name**: `smartkhabar_db` 
   - **Region**: Choose closest to you:
     - US East (Virginia) - `us-east-1`
     - US West (Oregon) - `us-west-2`
     - Europe (Frankfurt) - `eu-central-1`
3. **Click "Create Project"**

## Step 3: Get Your Connection String

1. **On the project dashboard, look for "Connection Details"**
2. **Copy the connection string** - it looks like:
   ```
   postgresql://username:password@ep-xxx-xxx.us-east-1.aws.neon.tech/smartkhabar_db?sslmode=require
   ```
3. **It will be something like:**
   ```
   postgresql://smartkhabar_owner:AbC123XyZ@ep-cool-mountain-12345678.us-east-1.aws.neon.tech/smartkhabar_db?sslmode=require
   ```

## Step 4: Add to Your Environment

1. **Open your `.env.local` file**
2. **Replace this line:**
   ```bash
   DATABASE_URL=your_neon_connection_string_here
   ```
3. **With your actual connection string:**
   ```bash
   DATABASE_URL=postgresql://your_username:your_password@ep-xxx.us-east-1.aws.neon.tech/smartkhabar_db?sslmode=require
   ```

## Step 5: Test Your Connection

Run this command to test your database connection:

```bash
# Install PostgreSQL client if you don't have it
npm install pg @types/pg

# Test connection
node -e "
const { Client } = require('pg');
const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function test() {
  try {
    await client.connect();
    const result = await client.query('SELECT version()');
    console.log('✅ Database connected successfully!');
    console.log('PostgreSQL version:', result.rows[0].version);
    await client.end();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  }
}

test();
"
```

## Step 6: Create Database Tables

Once connected, you'll need to create the necessary tables. Run:

```bash
# This will create all required tables
npm run db:setup
```

## Your Complete .env.local File

After getting your Neon connection string, your file should look like:

```bash
# Database Configuration (Neon PostgreSQL - Free)
DATABASE_URL=postgresql://your_username:your_password@ep-xxx.us-east-1.aws.neon.tech/smartkhabar_db?sslmode=require

# Free API Configuration
GNEWS_API_KEY=[YOUR_GNEWS_API_KEY]
HUGGINGFACE_API_KEY=[YOUR_HUGGINGFACE_API_KEY]

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development

# Legacy/Backup Configuration (Keep if you have them)
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
NEWS_API_KEY=your_news_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
FIRECRAWL_API_KEY=your_firecrawl_api_key_here
```

## Neon Free Tier Limits

✅ **3GB Storage** - Plenty for news articles  
✅ **100 Compute Hours/Month** - Auto-sleeps when inactive  
✅ **Unlimited Queries** - No query limits  
✅ **1 Database** - Perfect for SmartKhabar  
✅ **Automatic Backups** - Point-in-time recovery  

## What Happens Next?

1. **Get your Neon connection string** (follow steps above)
2. **Update `.env.local`** with the connection string
3. **Test the connection** with the provided script
4. **Run the app**: `npm run dev`
5. **Deploy to Vercel**: `npm run vercel:deploy`

## Troubleshooting

### Connection Issues
```bash
# Check if your connection string is correct
echo $DATABASE_URL

# Test with psql (if installed)
psql "your_connection_string_here" -c "SELECT version();"
```

### Common Errors

**Error: "password authentication failed"**
- Double-check your connection string
- Make sure you copied the full string including password

**Error: "database does not exist"**
- The database should be created automatically
- Check the database name in your connection string

**Error: "connection timeout"**
- Check your internet connection
- Try a different region when creating the project

## Need Help?

1. **Neon Documentation**: [docs.neon.tech](https://docs.neon.tech/)
2. **Neon Discord**: [discord.gg/neon](https://discord.gg/neon)
3. **Check your project dashboard** for connection details

## Next Steps After Setup

Once your database is connected:

1. **Start development**: `npm run dev`
2. **Test APIs**: Visit `http://localhost:3000/api/health`
3. **Deploy**: `npm run vercel:deploy`

Your SmartKhabar will be running on a completely free stack! 🎉