import { NextRequest, NextResponse } from 'next/server';
import { pool } from '../../../predictionMarket_db';

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { matchId, field, status } = body;
    
    if (!matchId || !field || !status) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: matchId, field, status' },
        { status: 400 }
      );
    }

    if (!['user_status', 'close_condition_user_status'].includes(field)) {
      return NextResponse.json(
        { success: false, error: 'Invalid field. Must be user_status or close_condition_user_status' },
        { status: 400 }
      );
    }

    if (!['confirmed', 'rejected', 'proposed'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status. Must be confirmed, rejected, or proposed' },
        { status: 400 }
      );
    }
    
    const client = await pool.connect();
    
    try {
      // Validate field name to prevent SQL injection
      const validFields = ['user_status', 'close_condition_user_status'];
      if (!validFields.includes(field)) {
        return NextResponse.json(
          { success: false, error: 'Invalid field name' },
          { status: 400 }
        );
      }
      
      const query = `
        UPDATE market_matches 
        SET ${field} = $1
        WHERE id = $2
        RETURNING id, ${field}
      `;
      
      const result = await client.query(query, [status, matchId]);
      
      if (result.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Market match not found' },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        success: true,
        data: result.rows[0]
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update market match status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
