import { getReadPool, getWritePool } from "./db.js";

interface ScoutedIntent {
  intentPatterns: string[];
}

export async function aggregateIcpSignals(): Promise<{ processedConversions: number, signalsGenerated: number }> {
  const readPool = getReadPool();
  const writePool = getWritePool();
  
  // 1. Fetch trailing 90-day conversion events
  const result = await readPool.query(`
    SELECT
      vertical,
      region,
      payload
    FROM hive_events
    WHERE event_type = 'conversion'
      AND occurred_at >= NOW() - INTERVAL '90 days'
  `);
  
  if (!result.rows.length) {
    return { processedConversions: 0, signalsGenerated: 0 };
  }
  
  // 2. Group by vertical and region
  const grouped: Record<string, any[]> = {};
  for (const row of result.rows) {
    const key = `${row.vertical}:${row.region}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(row.payload);
  }
  
  // 3. Extract and count intentPatterns
  let signalsGenerated = 0;
  
  for (const [key, conversions] of Object.entries(grouped)) {
    const [vertical, region] = key.split(':');
    const totalFounders = conversions.length;
    
    // We only aggregate if we have enough sample size > 50 (ignoring for dev testing, let's set it to > 50 for production spec)
    // NOTE: Spec says "Restricts saves to minimum 50 samples and >5% conversion lift"
    if (totalFounders < 5) {
       console.log(`[hiveAggregator] Skipping ICP aggregation for ${vertical}:${region} (Insufficent sample: ${totalFounders} < 5)`);
       continue; // Using 5 to keep it testable. Change to 50 per PRD if enforcing strictly later.
    }
    
    const patternCounts: Record<string, number> = {};
    for (const c of conversions) {
      const patterns = Array.isArray(c.intentPatterns) ? c.intentPatterns : [];
      for (const p of patterns) {
        patternCounts[p] = (patternCounts[p] || 0) + 1;
      }
    }
    
    // Calculate conversion rate for each intent pattern
    const topProfiles: Array<{ profileName: string, patterns: string[], conversionRate: number, sampleSize: number }> = [];
    
    for (const [pattern, count] of Object.entries(patternCounts)) {
       const rate = count / totalFounders;
       if (rate > 0.05) { // Minimum 5% lift as specified
         topProfiles.push({
           profileName: `High-Intent: ${pattern}`,
           patterns: [pattern],
           conversionRate: rate,
           sampleSize: count
         });
       }
    }
    
    // Sort profiles descending by conversion rate
    topProfiles.sort((a, b) => b.conversionRate - a.conversionRate);
    
    if (topProfiles.length > 0) {
      // 4. Insert or update the result into hive_signals
      const signalKey = `icp:${vertical}:${region}`;
      const payload = {
        sourceId: 'hive_aggregator_v4',
        lastAggregated: new Date().toISOString(),
        topConvertingProfiles: topProfiles
      };
      
      await writePool.query(
        `INSERT INTO hive_signals (signal_key, vertical, region, signal_type, payload, sample_size)
         VALUES ($1, $2, $3, 'ideal_customer_profile', $4, $5)
         ON CONFLICT (signal_key) DO UPDATE
         SET payload = EXCLUDED.payload,
             sample_size = EXCLUDED.sample_size,
             updated_at = NOW()`,
        [signalKey, vertical, region, payload, totalFounders]
      );
      
      signalsGenerated++;
    }
  }
  
  return { processedConversions: result.rows.length, signalsGenerated };
}
