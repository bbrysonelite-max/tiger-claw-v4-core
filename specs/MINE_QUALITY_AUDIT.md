# MINE QUALITY AUDIT (Task #18)

**Audit Date:** 2026-03-29  
**Total Facts in Moat:** 8,704  
**Sample Size:** 20 random rows across flavors  
**Methodology:** Evaluation on ACTIONABLE, SPECIFIC, SOURCE ATTRIBUTION, and EXTRACTION QUALITY criteria.

---

## 1. Database Stats & Health

| Metric | Result |
|---|---|
| **Total Fact Count** | 8,704 |
| **Active Domains** | 16 |
| **120-Day Decay** | ✅ Working (8,578 rows have `valid_until` populated) |
| **Extraction Quality** | ✅ 100% clean text in sample |

### Flavor Distribution (Top 10)
1. Network Marketer: 822
2. Real Estate Agent: 746
3. Health & Wellness: 687
4. Airbnb Host: 658
5. Interior Designer: 628
6. Mortgage Broker: 615
7. Plumber / Trades Professional: 614
8. Gig Economy Guide: 589
9. Candle Maker / Artisan: 587
10. Lawyer / Attorney: 561

---

## 2. Audit Results

**Total Possible Passes:** 80 (20 facts x 4 criteria)  
**Total Actual Passes:** 66  
**Total Pass Rate:** 82.5%

### Criteria Breakdown

| Criterion | Pass Rate | Worst Performer |
|---|---|---|
| **Actionable** | 8/20 (40%) | Lawyer, Plumber, Mortgage Broker |
| **Specific** | 19/20 (95%) | Personal Trainer |
| **Source Attribution** | 19/20 (95%) | Real Estate Agent (1 unknown source) |
| **Extraction Quality** | 20/20 (100%) | N/A (Perfectly clean text) |

---

## 3. Qualitative Findings

### The Niche Mapping Problem (CRITICAL)
While the extraction engine itself is technically sound (high specificity and extraction quality), the **Niche Mapping** is failing. The system is correctly extracting "facts" from Reddit, but it is assigning them to commercial domains where they have zero business relevance.

*3 Specific Examples of Bad Extractions:*
1. **Domain: Lawyer / Attorney** — Extracted a request for a partner to play *Baldur's Gate 3* from `r/gaymers`. (Irrelevant to legal services).
2. **Domain: Mortgage Broker** — Extracted intent to "reroll a feather artifact" (game mechanic) from `r/ScaramoucheMains`. (Irrelevant to mortgages).
3. **Domain: Plumber / Trades Professional** — Extracted a complaint about "Repeated KYC verification" from `r/PaliaMMO`. (Irrelevant to plumbing).

### Worst Performing Criterion: ACTIONABLE (40%)
The majority of failed passes were due to the fact being completely unrelated to the business domain. The engine is "successfully" purifying junk.

---

## 4. Recommendations

1. **Tighten Scout Queries:** (Claude's Lane) Reduce the footprint of keywords that overlap with gaming and lore terminology.
2. **Relevance Gate:** (Gemini's Lane) Implement a post-extraction verification step to ensure the fact actually pertains to the commercial domain before saving to `market_intelligence`.
3. **Decay Monitoring:** Continue monitoring the `valid_until` column to ensure automated cleanup of stale facts.

---

*Audit performed by GEMINI agent. 2026-03-29.*
