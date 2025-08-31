import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Test database connection
    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    const client = await pool.connect();
    
    // Test basic query
    const result = await client.query('SELECT NOW() as current_time');
    
    // Test if tables exist
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    // Neon client doesn't need manual release
    await pool.end();
    
    return NextResponse.json({
      status: 'success',
      database: 'connected',
      currentTime: result.rows[0]?.current_time,
      tables: tablesResult.rows.map(row => row.table_name),
      environment: {
        DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
        NODE_ENV: process.env.NODE_ENV
      }
    });

  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      database: 'failed',
      error: error.message,
      environment: {
        DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
        NODE_ENV: process.env.NODE_ENV
      }
    }, { status: 500 });
  }
}
