import { logger } from '../../utils/logger.js';
import type { PolymarketMarket } from '../../types/polymarket/polymarket.js';
import { promises as fs } from 'fs';
import * as path from 'path';

export async function getPolymarketEvents(saveToFile: boolean = true): Promise<PolymarketMarket[]> {
  const baseUrl = 'https://gamma-api.polymarket.com';
  const limit = 500;
  
  logger.info('🚀 Starting Polymarket events fetch and export...');
  
  const allMarkets: PolymarketMarket[] = [];
  let offset = 0;
  let hasMore = true;
  let pageCount = 0;

  logger.info(`📄 Fetching all markets from Polymarket with limit ${limit}...`);

  while (hasMore) {
    pageCount++;
    logger.info(`📄 Fetching page ${pageCount} (offset: ${offset})...`);
    
    const url = `${baseUrl}/markets?active=true&closed=false&archived=false&limit=${limit}&offset=${offset}`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Polymarket API error: ${response.status} ${response.statusText}`);
      }

      const markets: PolymarketMarket[] = await response.json();
      
      logger.info(`✅ Found ${markets.length} markets`);
      
      if (markets.length === 0) {
        hasMore = false;
        logger.info(`🏁 No more markets found`);
      } else {
        allMarkets.push(...markets);
        
        // If we got less than the limit, we're probably at the end
        if (markets.length < limit) {
          hasMore = false;
          logger.info(`🏁 Reached end of results (got ${markets.length} < ${limit})`);
        } else {
          offset += limit;
        }
      }

      logger.info(`📊 Total markets collected so far: ${allMarkets.length}`);
      
      // Add a small delay to be respectful to the API
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    } catch (error) {
      logger.error('❌ Error fetching markets from Polymarket:', error);
      throw error;
    }
  }

  logger.info(`🎉 Completed! Total markets fetched: ${allMarkets.length} across ${pageCount} pages`);
  
  // Save to file only if requested
  if (saveToFile) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const exportDir = path.join(process.cwd(), 'data-exports', 'getPolymarketEvents', timestamp);
    
    // Create the directory if it doesn't exist
    await fs.mkdir(exportDir, { recursive: true });
    
    const filePath = path.join(exportDir, 'markets.json');
    
    const exportData = {
      metadata: {
        exportTimestamp: new Date().toISOString(),
        totalMarkets: allMarkets.length,
        source: 'Polymarket API',
        endpoint: `${baseUrl}/markets`,
        filters: {
          active: true,
          closed: false,
          archived: false,
          limit: 200
        }
      },
      markets: allMarkets
    };

    await fs.writeFile(filePath, JSON.stringify(exportData, null, 2), 'utf8');
    
    logger.info(`💾 Saved ${allMarkets.length} markets to ${filePath}`);
    logger.info(`✅ Successfully exported ${allMarkets.length} markets to ${filePath}`);
  } else {
    logger.info(`📊 Returning ${allMarkets.length} markets without saving to file`);
  }
  
  return allMarkets;
}
