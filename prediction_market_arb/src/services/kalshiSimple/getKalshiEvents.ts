import { logger } from '../../utils/logger.js';
import type { KalshiEvent, KalshiEventsResponse } from '../../types/kalshi/kalshi.js';
import { promises as fs } from 'fs';
import path from 'path';

export async function getKalshiEvents(saveToFile: boolean = true): Promise<KalshiEvent[]> {
  const baseUrl = 'https://api.elections.kalshi.com/trade-api/v2';
  const limit = 200;
  
  logger.info('🚀 Starting Kalshi events fetch and export...');
  
  const allEvents: KalshiEvent[] = [];
  let cursor: string | undefined;
  let hasMore = true;
  let pageCount = 0;

  logger.info(`📄 Fetching all events from Kalshi with limit ${limit}...`);

  while (hasMore) {
    pageCount++;
    logger.info(`📄 Fetching page ${pageCount}...`);
    
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    params.append('status', 'open');
    params.append('with_nested_markets', 'true');
    
    if (cursor) {
      params.append('cursor', cursor);
    }

    const url = `${baseUrl}/events?${params.toString()}`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Kalshi API error: ${response.status} ${response.statusText}`);
      }

      const data: KalshiEventsResponse = await response.json();
      
      logger.info(`✅ Found ${data.events.length} events`);
      
      allEvents.push(...data.events);
      
      // Check if we have more results
      if (data.events.length === 0) {
        hasMore = false;
        logger.info(`🏁 No more events found`);
      } else {
        // Use the cursor from the response for next page
        cursor = data.cursor;
        if (!cursor) {
          hasMore = false;
          logger.info('🏁 No more cursor available, stopping pagination');
        }
      }

      logger.info(`📊 Total events collected so far: ${allEvents.length}`);
      
      // Add a small delay to be respectful to the API
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    } catch (error) {
      logger.error('❌ Error fetching events from Kalshi:', error);
      throw error;
    }
  }

  logger.info(`🎉 Completed! Total events fetched: ${allEvents.length} across ${pageCount} pages`);
  
  // Save to file only if requested
  if (saveToFile) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const exportDir = path.join(process.cwd(), 'data-exports', 'getKalshiEvents', timestamp);
    
    // Create the directory if it doesn't exist
    await fs.mkdir(exportDir, { recursive: true });
    
    const filePath = path.join(exportDir, 'events.json');
    
    const exportData = {
      metadata: {
        exportTimestamp: new Date().toISOString(),
        totalEvents: allEvents.length,
        source: 'Kalshi API',
        endpoint: `${baseUrl}/events`,
        filters: {
          status: 'open',
          limit: 200
        }
      },
      events: allEvents
    };

    await fs.writeFile(filePath, JSON.stringify(exportData, null, 2), 'utf8');
    
    logger.info(`💾 Saved ${allEvents.length} events to ${filePath}`);
    logger.info(`✅ Successfully exported ${allEvents.length} events to ${filePath}`);
  } else {
    logger.info(`📊 Returning ${allEvents.length} events without saving to file`);
  }
  
  return allEvents;
}
