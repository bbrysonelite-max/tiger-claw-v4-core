# MINE QUALITY AUDIT (Task #18)

**Audit Date:** 2026-03-29  
**Total Facts in Moat:** 7,872  
**Sample Size:** 20 random rows across flavors  
**Methodology:** Evaluation on ACTIONABLE, SPECIFIC, SOURCE ATTRIBUTION, and EXTRACTION QUALITY criteria.

---

## 1. Database Stats & Health

| Metric | Result |
|---|---|
| **Total Fact Count** | 7,872 |
| **Active Domains** | 16 |
| **120-Day Decay** | ✅ Working (7,746 rows have `valid_until` populated with 120-day TTL) |
| **Mining Cost Tracking** | ✅ Operational ($0.04 - $0.05 per fact) |
| **Provenance Tracking** | ⚠️ Partial (Older rows missing `entity_id`) |

### Flavor Distribution (Top 10)
1. Network Marketer: 741
2. Real Estate Agent: 664
3. Health & Wellness: 634
4. Airbnb Host: 587
5. Mortgage Broker: 564
6. Plumber / Trades Professional: 555
7. Interior Designer: 546
8. Gig Economy Guide: 537
9. Candle Maker / Artisan: 536
10. Lawyer / Attorney: 520

---

## 2. Audit Results

**Total Possible Passes:** 80 (20 facts x 4 criteria)  
**Total Actual Passes:** 52  
**Total Pass Rate:** 65%

### Criteria Breakdown

| Criterion | Pass Rate | Worst Performer |
|---|---|---|
| **Actionable** | 11/20 (55%) | Interior Designer, Plumber |
| **Specific** | 14/20 (70%) | Personal Trainer |
| **Source Attribution** | 20/20 (100%) | N/A (All traceable to Reddit) |
| **Extraction Quality** | 17/20 (85%) | N/A (Clean JSON/Text) |

---

## 3. Qualitative Findings

### The Hallucination / Mapping Problem (CRITICAL)
The miner is successfully pulling data but the **Niche Mapping** is failing when subreddits overlap or naming is ambiguous. 

*Example of Bad Extractions:*
1. **Domain: Plumber / Trades Professional** — Pulled a fact about community management in a sci-fi story from `/r/HFY`. (Irrelevant)
2. **Domain: College Dorm Interior Design** — Pulled a fact about "Pretendo Nimbus" (gaming hardware) from `/r/AnimalCrossingNewLeaf`. (Irrelevant)
3. **Domain: Interior Designer** — Pulled a lore fact about "Blood Ravens" from `/r/40kLore`. (Irrelevant)

### Worst Performing Criterion: ACTIONABLE (55%)
Many facts are technically "correct" extractions of text but of zero value to a business tenant (e.g., lore about fictional space marines mapped to Interior Design).

### Extraction Quality
Text extraction itself is high quality. No HTML tags, no malformed JSON in the metadata, and concise `fact_summary` fields.

---

## 4. Recommendations

1. **Tighten Subreddit Filtering:** The "Plumber" and "Interior Designer" flavors are catching broad keywords in unrelated enthusiast/gaming subreddits.
2. **Refine Domain Classifier:** Add a verification step in the refinery to ensure the extracted fact actually pertains to the intended commercial domain.
3. **Cross-Flavor Alchemy:** unique `entity_id` is now being captured (`u/DarwinianSelector`), which will enable the planned Cross-Flavor Bridge Lead feature.

---

*Audit performed by GEMINI agent. 2026-03-29.*
