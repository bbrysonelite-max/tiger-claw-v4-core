-- Migration: 008_line_timing_data.sql
-- Populates the LINE Official Account timing signal placeholder.
-- Replaces the sample_size=0 placeholder seeded in 006_hive_universal_prior.sql.
--
-- Primary sources:
--   LINE Yahoo official benchmark (Japan, June 2022) — 55% open rate
--   Lstep user survey n=1,000 (Japan, August 2023) — frequency preference
--   ligla.jp / lme.jp / onecruise.co.jp — timing and industry breakdowns
--   LINE Developers Thailand / medium.com/linedevth — Thailand case studies
--   LINEYahoo for Business note.com — 36.12% block rate official figure
--
-- Data quality notes (read before modifying this file):
--   1. Japan open rate (55%) is LINE Yahoo's own published figure — most defensible.
--      The 60-65% range reflects 2023-2024 market consensus; 80-90% Thai figure
--      is agency-reported, not LINE-official. Use ranges, not single numbers.
--   2. Taiwan has no published OA open rate. Japan figure is the closest proxy.
--   3. Reply rate is not published by LINE. Block rate is the negative-engagement proxy.
--   4. Three LINE OA Media Guide PDFs were not fetched and may contain more granular
--      data. Retrieve and parse before the next annual update:
--        - 2023 Q3: https://vos.line-scdn.net/lbstw-static/images/uploads/download_files/19d33dd84059038a75e4736a87dd0578/2023Q3_LINE%20Official%20Account%20Media%20Guide%20EN.pdf
--        - Apr-Sep 2024: https://www.lycbiz.com/sites/default/files/media/jp/download/EN_LINE%20Business%20Guide_202404-09_summary.pdf
--        - Jul 2025: https://www.lycbiz.com/sites/default/files/media/jp/download/LY_Corporation_MediaGuide_EN.pdf

UPDATE hive_signals
SET
  payload = '{
    "userLabel": "LINE Official Account engagement data across Southeast Asia and Japan",

    "openRate": {
      "japan": {
        "official": 55,
        "officialSource": "LINE Yahoo official benchmark, June 2022",
        "marketConsensus2024": "60-65",
        "sameDayCumulative": 80,
        "notes": "55% is LINE Yahoo published average. 60-65% reflects 2023-2024 practitioner consensus. 80% of opens occur within same calendar day."
      },
      "thailand": {
        "agencyReported": "80-90",
        "outlier": 94.6,
        "outlierSource": "Hashmeta 2025 — no methodology cited, treat as aspirational",
        "notes": "No LINE-official Thailand open rate published. 80-90% is agency consensus. Use with caveat that methodology varies."
      },
      "taiwan": {
        "openRate": null,
        "proxy": "Use Japan 55-65% as closest comparable market",
        "available": "87% find OA messages attractive; 81% say messages increase purchase intent (LINE Taiwan official, ~2024)"
      }
    },

    "messageOpenSpeed": {
      "region": "Japan (LINE Yahoo research)",
      "immediately": 20,
      "within3to6Hours": 50,
      "withinSameDay": 80,
      "implication": "Users see messages fast — reciprocal expectation that the business responds quickly too. Auto-reply for off-hours is strongly recommended."
    },

    "bestContactWindows": {
      "dailyPeaks": [
        {
          "window": "09:00-10:00",
          "context": "Morning commute — checking phone on train or bus"
        },
        {
          "window": "12:00-13:00",
          "context": "Lunch break"
        },
        {
          "window": "18:00-19:00",
          "context": "Evening commute home"
        },
        {
          "window": "21:00-22:00",
          "context": "Pre-sleep phone use — highest engagement for consumer brands"
        }
      ],
      "byIndustry": {
        "restaurant": {
          "bestDays": ["Friday", "Saturday"],
          "bestHours": "10:00-11:00 weekdays for lunch; 16:00-18:00 Friday for evening"
        },
        "retail_ecommerce": {
          "bestDays": ["Weekday evenings", "Weekend"],
          "bestHours": "20:00-21:00 weekdays; 14:00-16:00 weekends"
        },
        "beauty_salon": {
          "bestDays": ["Weekdays"],
          "bestHours": "20:00-21:00 post-work"
        },
        "b2b_saas": {
          "bestDays": ["Tuesday", "Thursday"],
          "bestHours": "09:00-10:00, 12:00-13:00"
        },
        "real_estate_insurance": {
          "bestDays": ["Monday", "Thursday"],
          "bestHours": "09:00-10:00, 12:00-13:00"
        },
        "network_marketer": {
          "bestDays": ["Tuesday", "Thursday", "Friday"],
          "bestHours": "12:00-13:00, 21:00-22:00",
          "notes": "Evening window important — prospects are part-time, checking phone after work hours"
        }
      },
      "overallHighestOpenDay": "Friday",
      "sources": ["ligla.jp day-of-week guide 2024", "lme.jp delivery timing guide", "onecruise.co.jp open rate best practices"]
    },

    "followUpCadence": {
      "optimalDaysBetweenMessages": 7,
      "optimalMonthlyFrequency": "3-4",
      "industryMaximums": {
        "restaurant": "2-3 times per week",
        "highConsideration": "1-2 times per month",
        "general": "3-4 times per month"
      },
      "userPreferenceSurvey": {
        "sampleSize": 1000,
        "region": "Japan",
        "date": "August 2023",
        "source": "Lstep (Lステップ) official blog survey",
        "results": {
          "oncePerWeek": 39.2,
          "noLimitIfContentUseful": 15.8,
          "haveBlockedAnOA": 76.5
        },
        "lineYahooRecommendation": "Approximately once per week"
      },
      "maxBeforeBlockRisk": "Daily messaging or more than 2-3 times per week for non-restaurant brands triggers measurable block rate increase"
    },

    "blockRate": {
      "japan": {
        "officialAverage": 36.12,
        "officialSource": "LINEYahoo for Business, note.com/lycbiz — official industry breakdown",
        "practitionerRange": "20-30",
        "practitionerSources": ["mico-inc.com", "lme.jp", "ligla.jp"]
      },
      "thailand": {
        "reported": "20-30",
        "outlierRisk": "50%+ when over-broadcasting",
        "source": "clisk.co.th Thailand LINE OA block rate guide"
      },
      "definition": "Blocked users remain counted as Friends but messages no longer reach them. Target Reach = Total Friends minus Blocked. Blocking does not equal unfriending — LINE OA has no equivalent unfollow without blocking."
    },

    "ctr": {
      "broadcastAverage": 13,
      "source": "Digital Marketing for Asia, citing LINE",
      "vsEmail": "LINE OA ~13% CTR vs email 1-5% CTR in Asia",
      "retargetingLift": {
        "liftPct": 300,
        "description": "Sending follow-up to users who already opened a broadcast (retargeting to engaged users) achieved 300% CTR increase vs initial broadcast baseline",
        "source": "medium.com/linedevth — LINE Developers Thailand retargeting experiment",
        "region": "Thailand"
      }
    },

    "platformPenetration": {
      "thailand": {
        "mau": 54000000,
        "population": 66000000,
        "penetrationPct": 82,
        "smartphoneUserPct": 94,
        "avgDailyMinutes": 67,
        "primaryUseCase": "Messaging, shopping, LINE Voom (social), stickers, LINE Pay"
      },
      "japan": {
        "mau": 97000000,
        "penetrationPct": 77,
        "dominance": "Primary messaging platform; used for business, government, and consumer communication"
      },
      "taiwan": {
        "mau": 22000000,
        "population": 23400000,
        "penetrationPct": 94,
        "appOpenFrequency": "Average 14 times per day"
      }
    },

    "operatorNotes": {
      "pdfSourcesNotYetParsed": [
        "2023 Q3 LINE Official Account Media Guide EN — https://vos.line-scdn.net/lbstw-static/images/uploads/download_files/19d33dd84059038a75e4736a87dd0578/2023Q3_LINE%20Official%20Account%20Media%20Guide%20EN.pdf",
        "LINE Business Guide Apr-Sep 2024 — https://www.lycbiz.com/sites/default/files/media/jp/download/EN_LINE%20Business%20Guide_202404-09_summary.pdf",
        "LY Corporation Media Guide Jul 2025 — https://www.lycbiz.com/sites/default/files/media/jp/download/LY_Corporation_MediaGuide_EN.pdf"
      ],
      "nextAnnualReviewDue": "2027-03",
      "dataGaps": [
        "Taiwan-specific OA open rate — not published publicly",
        "Reply rate by message type — not published by LINE",
        "Rich message vs plain text open rate comparison — qualitative only",
        "Thailand-specific timing windows — Japan data used as proxy"
      ]
    },

    "sourceId": "LINE_OFFICIAL_ACCOUNTS",
    "sourceYear": 2024
  }',
  sample_size = 1000,
  updated_at  = now()
WHERE signal_key = 'timing:universal:sea';

-- Activate the source record
UPDATE hive_prior_sources
SET
  status       = 'active',
  source_year  = 2024,
  last_updated = now()
WHERE source_id = 'LINE_OFFICIAL_ACCOUNTS';
