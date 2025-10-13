import { pool } from '../predictionMarket_db.js';
import { logger } from '../utils/logger.js';
import OpenAI from 'openai';
import { aiMatchCheckerPrompt } from './prompts/aiMatchCheckerPrompt.js';

type AiDecision = {
  ai_status: 'confirmed' | 'rejected';
  is_inversed: boolean;
  notes?: string;
  close_condition_ai_status?: 'confirmed' | 'rejected' | 'proposed';
};

async function fetchProposedMatches(limit: number = 100): Promise<any[]> {
  const res = await pool.query(
    `SELECT mm.id, mm.market_id_a, mm.market_id_b, mm.score, mm.status,
            a.title AS a_title, a.platform_data AS a_platform, a.close_condition AS a_close_condition,
            b.title AS b_title, b.platform_data AS b_platform, b.close_condition AS b_close_condition,
            a.volume AS a_volume, b.volume AS b_volume
     FROM market_matches mm
     JOIN markets a ON a.id = mm.market_id_a
     JOIN markets b ON b.id = mm.market_id_b
     WHERE mm.ai_status = 'proposed'
       AND a.is_open = true
       AND b.is_open = true
     ORDER BY COALESCE(a.volume, 0) + COALESCE(b.volume, 0) DESC, mm.id ASC
     LIMIT $1`,
    [limit]
  );
  return res.rows;
}

type AiPairPayload = {
  id: number;
  market_a: { title: string; platform_data: any; close_condition: string | null };
  market_b: { title: string; platform_data: any; close_condition: string | null };
  score: number | string;
};

async function callAiCheckerBatch(pairs: AiPairPayload[]): Promise<Array<{ id: number } & AiDecision>> {
  // Summarized prompt: Provide the titles, close_condition, and key platform fields for both markets
  // (titles, questions/subtitles, outcome types, close conditions, time windows)
  // Ask the model to: 1) decide if they are the same underlying question
  // 2) if same, whether outcomes are inversed; 3) provide a brief rationale;
  // 4) assess close-condition alignment and return a separate AI status and score; Return JSON with
  // { ai_status: 'confirmed'|'rejected', is_inversed: boolean, notes: string,
  //   close_condition_score?: number, close_condition_ai_status?: 'confirmed'|'rejected'|'proposed' }.

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.warn('⚠️ OPENAI_API_KEY not set; skipping AI decisions for this batch');
    return [];
  }

  try {
    const openai = new OpenAI({ apiKey });
    const resp = await openai.responses.create({
      model: 'gpt-5-nano',
      store: false,
      instructions: aiMatchCheckerPrompt,
      input: JSON.stringify({ pairs }),
      text: { format: { type: 'text' } },
      reasoning: { effort: 'medium', summary: 'auto' },
      tools: []
    });

    const content: string | undefined = (resp as any)?.output_text
      ?? (Array.isArray((resp as any)?.output) && (resp as any).output[0]?.content?.[0]?.text?.value)
      ?? undefined;
    if (!content) {
      logger.warn('⚠️ Empty AI response; skipping updates for this batch');
      return [];
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      logger.warn('⚠️ AI response not valid JSON; skipping updates for this batch');
      return [];
    }

    if (!Array.isArray(parsed)) {
      logger.warn('⚠️ AI response is not an array; skipping updates for this batch');
      return [];
    }

    // Map decisions back to ids by order
    const results: Array<{ id: number } & AiDecision> = [];
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i] as AiPairPayload; // within bounds, safe
      const base = { id: pair.id } as any;
      const d = parsed[i] || {};
      results.push({
        ...base,
        ai_status: d.ai_status === 'confirmed' ? 'confirmed' : 'rejected',
        is_inversed: Boolean(d.is_inversed),
        notes: typeof d.notes === 'string' ? d.notes : undefined,
        close_condition_ai_status: d.close_condition_ai_status === 'confirmed' ? 'confirmed' : d.close_condition_ai_status === 'proposed' ? 'proposed' : 'rejected'
      });
    }
    return results;
  } catch (err) {
    logger.error('❌ OpenAI API error; skipping updates for this batch', err);
    return [];
  }
}

async function applyAiDecision(matchId: number, decision: AiDecision): Promise<void> {
  await pool.query(
    `UPDATE market_matches
     SET ai_status = $1,
         is_inversed = $2,
         close_condition_ai_status = COALESCE($3, close_condition_ai_status),
         notes = COALESCE($4, notes)
     WHERE id = $5`,
    [decision.ai_status, decision.is_inversed, decision.close_condition_ai_status ?? null, decision.notes ?? null, matchId]
  );
}

export async function runAiMatchChecker(batchSize: number = 50): Promise<void> {
  logger.info(`🤖 AI checker starting. Batch size: ${batchSize}, API chunk size: 10`);
  const chunkSize = 10; // per-API-call batch

  while (true) {
    const rows = await fetchProposedMatches(batchSize);
    if (!rows.length) {
      logger.info('✅ No more proposed matches to review.');
      break;
    }
    logger.info(`📥 Fetched ${rows.length} proposed matches for AI review`);

    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const payloads: AiPairPayload[] = chunk.map((row: any) => ({
        id: row.id,
        market_a: { title: row.a_title, platform_data: row.a_platform, close_condition: row.a_close_condition },
        market_b: { title: row.b_title, platform_data: row.b_platform, close_condition: row.b_close_condition },
        score: row.score
      }));
      try {
        const decisions = await callAiCheckerBatch(payloads);
        if (!decisions.length) {
          logger.warn('⚠️ No AI decisions returned; skipping updates for this chunk');
          continue;
        }
        for (const d of decisions) {
          await applyAiDecision(d.id, d);
          // Find the original row to get volume info
          const originalRow = chunk.find((row: any) => row.id === d.id);
          const totalVolume = (originalRow?.a_volume || 0) + (originalRow?.b_volume || 0);
          logger.info(`✅ AI reviewed match ${d.id}: ${d.ai_status}${d.is_inversed ? ' (inversed)' : ''} [Total Volume: ${totalVolume}]`);
        }
      } catch (e) {
        logger.error('❌ AI batch review failed', e);
      }
    }
  }

  logger.info('🤖 AI checker completed.');
}


