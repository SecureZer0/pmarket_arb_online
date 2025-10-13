import { NextRequest, NextResponse } from 'next/server';
import { pool } from '../../../predictionMarket_db';

export async function GET(request: NextRequest) {
  try {
    const client = await pool.connect();
    
    try {
      // Get filter parameters from URL
      const { searchParams } = new URL(request.url);
      const hideAiRejectedMarkets = searchParams.get('hideAiRejectedMarkets') === 'true';
      const hideAiRejectedCloseConditions = searchParams.get('hideAiRejectedCloseConditions') === 'true';
      const hideUserRejectedMarkets = searchParams.get('hideUserRejectedMarkets') === 'true';
      const hideUserRejectedCloseConditions = searchParams.get('hideUserRejectedCloseConditions') === 'true';

      // Build WHERE conditions based on filter parameters
      let whereConditions = [
        "mm.ai_status = 'confirmed'",
        `(
          CASE 
            WHEN platform_a.code = 'kalshi' THEN market_a.is_open
            WHEN platform_b.code = 'kalshi' THEN market_b.is_open
            ELSE market_a.is_open
          END
        ) IS TRUE`,
        `(
          CASE 
            WHEN platform_a.code = 'polymarket' THEN market_a.is_open
            WHEN platform_b.code = 'polymarket' THEN market_b.is_open
            ELSE market_b.is_open
          END
        ) IS TRUE`
      ];

      // Add filter conditions
      if (hideAiRejectedMarkets) {
        whereConditions.push("mm.ai_status != 'rejected'");
      }
      if (hideAiRejectedCloseConditions) {
        whereConditions.push("mm.close_condition_ai_status != 'rejected'");
      }
      if (hideUserRejectedMarkets) {
        whereConditions.push("mm.user_status != 'rejected'");
      }
      if (hideUserRejectedCloseConditions) {
        whereConditions.push("mm.close_condition_user_status != 'rejected'");
      }

      const whereClause = whereConditions.join(' AND ');

      // Query to fetch all market matches with volume data and calculate normalized volume rankings
      const query = `
        WITH kalshi_rankings AS (
          -- Step 1: Rank Kalshi markets by volume
          SELECT 
            m.id,
            m.platform_id,
            m.volume,
            ROW_NUMBER() OVER (
              ORDER BY COALESCE(m.volume, 0) DESC
            ) as volume_rank
          FROM markets m
          JOIN platforms p ON m.platform_id = p.id
          WHERE p.code = 'kalshi' AND m.volume IS NOT NULL
        ),
        polymarket_rankings AS (
          -- Step 2: Rank Polymarket markets by volume
          SELECT 
            m.id,
            m.platform_id,
            m.volume,
            ROW_NUMBER() OVER (
              ORDER BY COALESCE(m.volume, 0) DESC
            ) as volume_rank
          FROM markets m
          JOIN platforms p ON m.platform_id = p.id
          WHERE p.code = 'polymarket' AND m.volume IS NOT NULL
        ),
        volume_rankings AS (
          -- Step 3: Combine the rankings
          SELECT id, platform_id, volume, volume_rank FROM kalshi_rankings
          UNION ALL
          SELECT id, platform_id, volume, volume_rank FROM polymarket_rankings
        )
        SELECT 
          mm.id,
          mm.method,
          mm.score,
          mm.status,
          mm.ai_status,
          mm.user_status,
          mm.is_inversed,
          mm.close_condition_score,
          mm.close_condition_status,
          mm.close_condition_ai_status,
          mm.close_condition_user_status,
          mm.notes,
          mm.created_at,
          mm.market_id_a,
          mm.market_id_b,
          
          -- Always put Kalshi on the left (Market A)
          CASE 
            WHEN platform_a.code = 'kalshi' THEN market_a.id
            WHEN platform_b.code = 'kalshi' THEN market_b.id
            ELSE market_a.id
          END as market_a_id,
          CASE 
            WHEN platform_a.code = 'kalshi' THEN market_a.platform_id
            WHEN platform_b.code = 'kalshi' THEN market_b.platform_id
            ELSE market_a.platform_id
          END as market_a_platform_id,
          CASE 
            WHEN platform_a.code = 'kalshi' THEN market_a.external_id
            WHEN platform_b.code = 'kalshi' THEN market_b.external_id
            ELSE market_a.external_id
          END as market_a_external_id,
          CASE 
            WHEN platform_a.code = 'kalshi' THEN market_a.title
            WHEN platform_b.code = 'kalshi' THEN market_b.title
            ELSE market_a.title
          END as market_a_title,
          CASE 
            WHEN platform_a.code = 'kalshi' THEN market_a.url
            WHEN platform_b.code = 'kalshi' THEN market_b.url
            ELSE market_a.url
          END as market_a_url,
          CASE 
            WHEN platform_a.code = 'kalshi' THEN market_a.outcome_type
            WHEN platform_b.code = 'kalshi' THEN market_b.outcome_type
            ELSE market_a.outcome_type
          END as market_a_outcome_type,
          CASE 
            WHEN platform_a.code = 'kalshi' THEN market_a.start_time
            WHEN platform_b.code = 'kalshi' THEN market_b.start_time
            ELSE market_a.start_time
          END as market_a_start_time,
          CASE 
            WHEN platform_a.code = 'kalshi' THEN market_a.end_time
            WHEN platform_b.code = 'kalshi' THEN market_b.end_time
            ELSE market_a.end_time
          END as market_a_end_time,
          CASE 
            WHEN platform_a.code = 'kalshi' THEN market_a.close_condition
            WHEN platform_b.code = 'kalshi' THEN market_b.close_condition
            ELSE market_a.close_condition
          END as market_a_close_condition,
          CASE 
            WHEN platform_a.code = 'kalshi' THEN market_a.is_open
            WHEN platform_b.code = 'kalshi' THEN market_b.is_open
            ELSE market_a.is_open
          END as market_a_is_open,
          CASE 
            WHEN platform_a.code = 'kalshi' THEN market_a.platform_data
            WHEN platform_b.code = 'kalshi' THEN market_b.platform_data
            ELSE market_a.platform_data
          END as market_a_platform_data,
          CASE 
            WHEN platform_a.code = 'kalshi' THEN market_a.volume
            WHEN platform_b.code = 'kalshi' THEN market_b.volume
            ELSE market_a.volume
          END as market_a_volume,
          
          -- Always put Polymarket on the right (Market B)
          CASE 
            WHEN platform_a.code = 'polymarket' THEN market_a.id
            WHEN platform_b.code = 'polymarket' THEN market_b.id
            ELSE market_b.id
          END as market_b_id,
          CASE 
            WHEN platform_a.code = 'polymarket' THEN market_a.platform_id
            WHEN platform_b.code = 'polymarket' THEN market_b.platform_id
            ELSE market_b.platform_id
          END as market_b_platform_id,
          CASE 
            WHEN platform_a.code = 'polymarket' THEN market_a.external_id
            WHEN platform_b.code = 'polymarket' THEN market_b.external_id
            ELSE market_b.external_id
          END as market_b_external_id,
          CASE 
            WHEN platform_a.code = 'polymarket' THEN market_a.title
            WHEN platform_b.code = 'polymarket' THEN market_b.title
            ELSE market_b.title
          END as market_b_title,
          CASE 
            WHEN platform_a.code = 'polymarket' THEN market_a.url
            WHEN platform_b.code = 'polymarket' THEN market_b.url
            ELSE market_b.url
          END as market_b_url,
          CASE 
            WHEN platform_a.code = 'polymarket' THEN market_a.outcome_type
            WHEN platform_b.code = 'polymarket' THEN market_b.outcome_type
            ELSE market_b.outcome_type
          END as market_b_outcome_type,
          CASE 
            WHEN platform_a.code = 'polymarket' THEN market_a.start_time
            WHEN platform_b.code = 'polymarket' THEN market_b.start_time
            ELSE market_b.start_time
          END as market_b_start_time,
          CASE 
            WHEN platform_a.code = 'polymarket' THEN market_a.end_time
            WHEN platform_b.code = 'polymarket' THEN market_b.end_time
            ELSE market_b.end_time
          END as market_b_end_time,
          CASE 
            WHEN platform_a.code = 'polymarket' THEN market_a.close_condition
            WHEN platform_b.code = 'polymarket' THEN market_b.close_condition
            ELSE market_b.close_condition
          END as market_b_close_condition,
          CASE 
            WHEN platform_a.code = 'polymarket' THEN market_a.is_open
            WHEN platform_b.code = 'polymarket' THEN market_b.is_open
            ELSE market_b.is_open
          END as market_b_is_open,
          CASE 
            WHEN platform_a.code = 'polymarket' THEN market_a.platform_data
            WHEN platform_b.code = 'polymarket' THEN market_b.platform_data
            ELSE market_b.platform_data
          END as market_b_platform_data,
          CASE 
            WHEN platform_a.code = 'polymarket' THEN market_a.volume
            WHEN platform_b.code = 'polymarket' THEN market_b.volume
            ELSE market_b.volume
          END as market_b_volume,
          
          -- Platform names (always Kalshi left, Polymarket right)
          CASE 
            WHEN platform_a.code = 'kalshi' THEN platform_a.name
            WHEN platform_b.code = 'kalshi' THEN platform_b.name
            ELSE platform_a.name
          END as platform_a_name,
          CASE 
            WHEN platform_a.code = 'polymarket' THEN platform_a.name
            WHEN platform_b.code = 'polymarket' THEN platform_b.name
            ELSE platform_b.name
          END as platform_b_name,
          
          -- Volume rankings for ordering (normalized per platform)
          COALESCE(rank_a.volume_rank, 999999) as market_a_volume_rank,
          COALESCE(rank_b.volume_rank, 999999) as market_b_volume_rank,
          (COALESCE(rank_a.volume_rank, 999999) + COALESCE(rank_b.volume_rank, 999999)) as combined_volume_rank
          
        FROM market_matches mm
        LEFT JOIN markets market_a ON mm.market_id_a = market_a.id
        LEFT JOIN markets market_b ON mm.market_id_b = market_b.id
        LEFT JOIN platforms platform_a ON market_a.platform_id = platform_a.id
        LEFT JOIN platforms platform_b ON market_b.platform_id = platform_b.id
        LEFT JOIN volume_rankings rank_a ON (
          CASE 
            WHEN platform_a.code = 'kalshi' THEN market_a.id
            WHEN platform_b.code = 'kalshi' THEN market_b.id
            ELSE market_a.id
          END = rank_a.id
        )
        LEFT JOIN volume_rankings rank_b ON (
          CASE 
            WHEN platform_a.code = 'polymarket' THEN market_a.id
            WHEN platform_b.code = 'polymarket' THEN market_b.id
            ELSE market_b.id
          END = rank_b.id
        )
          WHERE ${whereClause}
        ORDER BY combined_volume_rank ASC, mm.created_at DESC
        LIMIT 250
      `;
      
      const result = await client.query(query);
      
      return NextResponse.json({
        success: true,
        data: result.rows,
        count: result.rows.length
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch market matches',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { market_id_a, market_id_b, method, score, status = 'proposed' } = body;
    
    if (!market_id_a || !market_id_b || !method || score === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    const client = await pool.connect();
    
    try {
      // Ensure market_id_a < market_id_b for consistent ordering
      const [minId, maxId] = [Math.min(market_id_a, market_id_b), Math.max(market_id_a, market_id_b)];
      
      const query = `
        INSERT INTO market_matches (market_id_a, market_id_b, method, score, status)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      
      const result = await client.query(query, [minId, maxId, method, score, status]);
      
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
        error: 'Failed to create market match',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
