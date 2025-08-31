import { NextResponse } from 'next/server';

export async function GET() {
  console.log('✅ Minimal test route called');
  
  return NextResponse.json({
    status: 'success',
    message: 'Minimal test route working',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB'
  });
}