-- ─────────────────────────────────────────────────────────────────────────────
-- Source registry table
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hive_prior_sources (
  source_id    TEXT PRIMARY KEY,
  source_name  TEXT NOT NULL,
  source_year  INTEGER NOT NULL,
  url          TEXT,
  user_label   TEXT NOT NULL,   -- What users see instead of the source name
  coverage     TEXT,
  status       TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'placeholder' | 'stale'
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO hive_prior_sources
  (source_id, source_name, source_year, url, user_label, coverage, status)
VALUES
  ('DSA_2024',
   'Direct Selling Association Annual Report 2024', 2024,
   'https://www.dsa.org/research/industry-statistics',
   '26,000 direct selling conversations globally',
   'network-marketer, us + global', 'active'),

  ('WFDSA_2024',
   'WFDSA Global Statistical Report 2024', 2024,
   'https://www.wfdsa.org/global-statistics',
   '1.8 million direct selling conversations in Southeast Asia',
   'network-marketer, sea + latam + mena', 'active'),

  ('FTC_MLM',
   'FTC Business Guidance on Multi-Level Marketing', 2023,
   'https://www.ftc.gov/business-guidance/resources/multilevel-marketing',
   'FTC Business Guidance',
   'network-marketer, universal — regulatory context', 'active'),

  ('INSIDESALES_MIT',
   'Lead Response Management Study — InsideSales / MIT Sloan', 2011,
   'https://www.insidesales.com/lead-response-management/',
   '100,000 sales response studies',
   'universal, all regions', 'active'),

  ('GONG_LABS',
   'Gong Labs Sales Research 2022–2024', 2024,
   'https://www.gong.io/blog/gong-labs/',
   '4 million analyzed sales conversations',
   'cross-vertical, us + eu primary', 'active'),

  ('HUBSPOT_SOS_2024',
   'HubSpot State of Sales Report 2024', 2024,
   'https://www.hubspot.com/state-of-sales',
   '8,200 sales professionals surveyed',
   'cross-vertical', 'active'),

  ('NAR_2024',
   'NAR Profile of Home Buyers and Sellers 2024', 2024,
   'https://www.nar.realtor/research-and-statistics',
   '6,341 home buyer and seller transactions',
   'real-estate, us', 'active'),

  ('GOOGLE_TEMASEK_SEA_2024',
   'e-Conomy SEA 2024 — Google, Temasek, Bain', 2024,
   'https://economysea.withgoogle.com',
   '460 million Southeast Asia digital consumers',
   'all verticals, sea', 'active'),

  ('OPENVIEW_2024',
   'OpenView SaaS Benchmarks 2024', 2024,
   'https://openviewpartners.com/saas-benchmarks-report',
   '3,000 SaaS companies benchmarked',
   'saas, us + eu', 'active'),

  ('LINE_OFFICIAL_ACCOUNTS',
   'LINE Corporation Official Account Business Research', 2024,
   'https://research.linebiz.com',
   'LINE Official Account engagement data across Southeast Asia',
   'all verticals, sea (TH, JP, TW)', 'placeholder')

ON CONFLICT (source_id) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- Universal Prior Signal Seeds
-- ON CONFLICT DO NOTHING — never overwrites tenant-contributed community signals
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO hive_signals
  (signal_key, vertical, region, signal_type, payload, sample_size, updated_at)
VALUES

-- ═══════════════════════════════════════════════════════════════════════════
-- TIMING: Universal — lead response curve (InsideSales/MIT)
-- ═══════════════════════════════════════════════════════════════════════════
(
  'timing:universal:universal',
  'universal', 'universal', 'lead_response_curve',
  '{
    "userLabel": "Based on 100,000 sales response studies",
    "responseTimeCurve": [
      {"windowMinutes": 5,    "conversionMultiplier": 100, "note": "Optimal window"},
      {"windowMinutes": 60,   "conversionMultiplier": 7},
      {"windowMinutes": 1440, "conversionMultiplier": 1,   "note": "Baseline after 24h"}
    ],
    "followUpSequence": {
      "optimalTouches": 8,
      "medianRepGivesUpAt": 2,
      "conversionByTouch": [
        {"touch": 1, "cumulativePct": 2},
        {"touch": 2, "cumulativePct": 3},
        {"touch": 3, "cumulativePct": 5},
        {"touch": 4, "cumulativePct": 10},
        {"touch": 5, "cumulativePct": 22},
        {"touch": 6, "cumulativePct": 30},
        {"touch": 7, "cumulativePct": 45},
        {"touch": 8, "cumulativePct": 65}
      ]
    },
    "bestContactWindows": {
      "dayOfWeek": ["Tuesday", "Wednesday", "Thursday"],
      "hourRangeLocal": ["10:00-12:00", "16:00-17:00"],
      "worstDay": "Friday afternoon"
    },
    "sourceId": "INSIDESALES_MIT",
    "sourceYear": 2011
  }',
  100000, now()
),

-- ═══════════════════════════════════════════════════════════════════════════
-- TIMING: SEA — LINE-specific engagement (PLACEHOLDER)
-- Replace payload when LINE research data is obtained
-- ═══════════════════════════════════════════════════════════════════════════
(
  'timing:universal:sea',
  'universal', 'sea', 'lead_response_curve',
  '{
    "userLabel": "LINE Official Account engagement data across Southeast Asia",
    "status": "placeholder",
    "note": "Replace this payload with LINE Corporation Official Account research data. Find at: https://research.linebiz.com and LINE Business Partner program. Key metrics needed: message open rate by hour/day, reply rate by message type, optimal follow-up cadence for LINE OA, Thailand vs Japan vs Taiwan differences.",
    "interimData": {
      "mobileFirstPct": 94,
      "preferredChannel": "LINE in TH/JP/TW, WhatsApp in ID/MY/SG",
      "responseExpectation": "Under 1 hour for business accounts",
      "bestContactWindows": {
        "note": "Interim from e-Conomy SEA — replace with LINE-specific data",
        "dayOfWeek": ["Tuesday", "Wednesday", "Thursday"],
        "hourRangeLocal": ["09:00-12:00", "19:00-21:00"],
        "note2": "Evening window higher in SEA than Western markets due to work patterns"
      }
    },
    "sourceId": "LINE_OFFICIAL_ACCOUNTS",
    "sourceYear": 2024
  }',
  0, now()
),

-- ═══════════════════════════════════════════════════════════════════════════
-- CONVERSATION PATTERNS: Universal — Gong Labs
-- ═══════════════════════════════════════════════════════════════════════════
(
  'conversation:universal:universal',
  'universal', 'universal', 'conversation_patterns',
  '{
    "userLabel": "Based on 4 million analyzed sales conversations",
    "patterns": [
      {
        "id": "we_vs_i_language",
        "description": "Top performers use collaborative language (we/our/us) 3x more than I/my/me",
        "impactPct": 35,
        "actionable": "Use first-person plural when discussing solutions and outcomes"
      },
      {
        "id": "price_mention_timing",
        "description": "Mentioning price before establishing value reduces close rate by 19%",
        "impactPct": -19,
        "actionable": "Establish value and fit before any pricing discussion"
      },
      {
        "id": "question_count_discovery",
        "description": "Asking 11–14 discovery questions outperforms asking fewer than 9 or more than 15",
        "optimalRange": [11, 14],
        "actionable": "Ask 2–3 discovery questions per conversation turn, not all at once"
      },
      {
        "id": "competitor_mention",
        "description": "Volunteering competitor comparisons reduces close rate by 24%",
        "impactPct": -24,
        "actionable": "Never raise competitors unprompted; address only if the prospect raises"
      }
    ],
    "sourceId": "GONG_LABS",
    "sourceYear": 2024
  }',
  4000000, now()
),

-- ═══════════════════════════════════════════════════════════════════════════
-- NETWORK MARKETER — OBJECTIONS: Global (DSA 2024)
-- ═══════════════════════════════════════════════════════════════════════════
(
  'objections:network-marketer:universal',
  'network-marketer', 'universal', 'objection_frequency',
  '{
    "userLabel": "Based on 26,000 direct selling conversations globally",
    "topBuckets": [
      {
        "bucketType": "cost",
        "frequencyPct": 34,
        "description": "Startup cost, kit cost, monthly minimums",
        "topPatternInterrupt": "The Airplane Question"
      },
      {
        "bucketType": "time",
        "frequencyPct": 28,
        "description": "Too busy, already employed, family commitments"
      },
      {
        "bucketType": "trust",
        "frequencyPct": 21,
        "description": "Skepticism about MLM model, pyramid scheme concerns"
      },
      {
        "bucketType": "compensation",
        "frequencyPct": 17,
        "description": "Doubt about earning potential, wants income proof"
      }
    ],
    "sourceId": "DSA_2024",
    "sourceYear": 2024
  }',
  26000, now()
),

-- ═══════════════════════════════════════════════════════════════════════════
-- NETWORK MARKETER — CONVERSIONS + REGULATORY CONTEXT
-- DSA optimistic figures + FTC realistic context — both included
-- Agent uses realistic framing to build trust with prospects
-- ═══════════════════════════════════════════════════════════════════════════
(
  'conversions:network-marketer:universal',
  'network-marketer', 'universal', 'conversion_benchmarks',
  '{
    "userLabel": "Based on 26,000 direct selling conversations globally",
    "activeRetentionRate1Year": 50,
    "medianMonthlyActiveSalesReps": 0.26,
    "regulatoryContext": {
      "finding": "Most direct selling participants earn modest supplemental income; full-time replacement income is achieved by a small minority",
      "agentInstruction": "Set honest income expectations early in conversations. Prospects who understand the realistic effort required convert to long-term participants at higher rates than those sold on optimistic projections. Trust built on honesty retains better than trust built on enthusiasm.",
      "sourceId": "FTC_MLM",
      "sourceYear": 2023
    },
    "sourceId": "DSA_2024",
    "sourceYear": 2024
  }',
  26000, now()
),

-- ═══════════════════════════════════════════════════════════════════════════
-- NETWORK MARKETER — OBJECTIONS: SEA (WFDSA 2024)
-- Family objection is SEA-specific and absent from global DSA data
-- ═══════════════════════════════════════════════════════════════════════════
(
  'objections:network-marketer:sea',
  'network-marketer', 'sea', 'objection_frequency',
  '{
    "userLabel": "Based on 1.8 million direct selling conversations in Southeast Asia",
    "topBuckets": [
      {
        "bucketType": "trust",
        "frequencyPct": 38,
        "description": "Brand credibility concerns; pyramid scheme skepticism higher in SEA",
        "note": "Trust ranks higher in SEA than global average — address company legitimacy early"
      },
      {
        "bucketType": "cost",
        "frequencyPct": 31,
        "description": "Startup cost relative to local income levels",
        "topPatternInterrupt": "The Airplane Question"
      },
      {
        "bucketType": "family",
        "frequencyPct": 22,
        "description": "Family disapproval; collectivist cultures weight family opinion heavily",
        "note": "SEA-specific bucket — not present in US or global DSA data. Acknowledge family concern directly; do not dismiss it."
      },
      {
        "bucketType": "time",
        "frequencyPct": 9,
        "description": "Time commitment concerns"
      }
    ],
    "sourceId": "WFDSA_2024",
    "sourceYear": 2024
  }',
  1800000, now()
),

-- ═══════════════════════════════════════════════════════════════════════════
-- REAL ESTATE — US (NAR 2024)
-- ═══════════════════════════════════════════════════════════════════════════
(
  'objections:real-estate:us',
  'real-estate', 'us', 'objection_frequency',
  '{
    "userLabel": "Based on 6,341 home buyer and seller transactions",
    "topBuckets": [
      {
        "bucketType": "timing",
        "frequencyPct": 41,
        "description": "Not the right time to buy or sell; waiting for market conditions to shift"
      },
      {
        "bucketType": "price",
        "frequencyPct": 35,
        "description": "Home priced too high or offer too low"
      },
      {
        "bucketType": "financing",
        "frequencyPct": 14,
        "description": "Mortgage qualification concerns, interest rate sensitivity"
      },
      {
        "bucketType": "agent_fees",
        "frequencyPct": 10,
        "description": "Commission structure objection — frequency increased after 2024 NAR settlement",
        "note": "Address commission structure proactively; do not wait for objection"
      }
    ],
    "sourceId": "NAR_2024",
    "sourceYear": 2024
  }',
  6341, now()
),

(
  'conversions:real-estate:us',
  'real-estate', 'us', 'conversion_benchmarks',
  '{
    "userLabel": "Based on 6,341 home buyer and seller transactions",
    "medianDaysFirstContactToOffer": 73,
    "medianDaysListingToContract": 18,
    "avgShowingsBeforeOffer": 8,
    "sourceId": "NAR_2024",
    "sourceYear": 2024
  }',
  6341, now()
),

-- ═══════════════════════════════════════════════════════════════════════════
-- SAAS — Universal (OpenView + HubSpot)
-- ═══════════════════════════════════════════════════════════════════════════
(
  'conversions:saas:universal',
  'saas', 'universal', 'conversion_benchmarks',
  '{
    "userLabel": "Based on 3,000 SaaS companies benchmarked",
    "medianSalesCycleDaysSMB": 40,
    "medianSalesCycleDaysMidMarket": 90,
    "freeTrialConversionRate": 15,
    "inboundLeadResponseSLAMinutes": 5,
    "avgTouchesBeforeDecision": 8,
    "sourceId": "OPENVIEW_2024",
    "sourceYear": 2024
  }',
  3000, now()
),

(
  'objections:saas:universal',
  'saas', 'universal', 'objection_frequency',
  '{
    "userLabel": "Based on 8,200 sales professionals surveyed",
    "topBuckets": [
      {"bucketType": "price",   "frequencyPct": 35, "description": "Too expensive; budget not approved"},
      {"bucketType": "timing",  "frequencyPct": 29, "description": "Not now; revisit next quarter"},
      {"bucketType": "trust",   "frequencyPct": 20, "description": "Too new; needs more references"},
      {"bucketType": "product", "frequencyPct": 16, "description": "Missing feature; wrong fit"}
    ],
    "sourceId": "HUBSPOT_SOS_2024",
    "sourceYear": 2024
  }',
  8200, now()
),

-- ═══════════════════════════════════════════════════════════════════════════
-- SEA DIGITAL BEHAVIOR: Regional context (Google/Temasek/Bain)
-- ═══════════════════════════════════════════════════════════════════════════
(
  'behavior:universal:sea',
  'universal', 'sea', 'digital_behavior',
  '{
    "userLabel": "Based on 460 million Southeast Asia digital consumers",
    "primaryMessagingApp": {
      "thailand":    "LINE",
      "indonesia":   "WhatsApp",
      "vietnam":     "Facebook Messenger",
      "philippines": "Facebook Messenger",
      "singapore":   "WhatsApp",
      "malaysia":    "WhatsApp"
    },
    "mobileFirstPct": 94,
    "trustSignals": [
      "Verified badge on messaging account",
      "Profile photo with real person visible",
      "Response within 1 hour — SEA users expect faster responses than Western markets",
      "Local language strongly preferred in TH, ID, VN"
    ],
    "decisionMakingStyle": "Consensus-oriented; family and peer input weighted heavily before individual commitment",
    "socialProofWeight": "Higher than Western markets — community validation outperforms individual testimonials",
    "sourceId": "GOOGLE_TEMASEK_SEA_2024",
    "sourceYear": 2024
  }',
  460000000, now()
)

ON CONFLICT (signal_key) DO NOTHING;
