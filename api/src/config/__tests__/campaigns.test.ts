import { describe, it, expect } from 'vitest';
import { MINE_CAMPAIGN_REGISTRY } from '../campaigns/index.js';

// MineCampaign registry contract — every campaign in here is hit by the
// orchestrator on every run, so a malformed entry breaks the daily mine for
// every other campaign too. These tests are the cheap structural guard.

describe('MINE_CAMPAIGN_REGISTRY', () => {
  const entries = Object.entries(MINE_CAMPAIGN_REGISTRY);

  it('contains at least one campaign (SSDI Ticket to Work)', () => {
    expect(entries.length).toBeGreaterThan(0);
    expect(MINE_CAMPAIGN_REGISTRY['ssdi-ticket-to-work']).toBeDefined();
  });

  it.each(entries)('campaign "%s" has the required hunting fields', (_key, campaign) => {
    expect(campaign.key).toBeTruthy();
    expect(campaign.displayName).toBeTruthy();
    expect(campaign.description).toBeTruthy();
    expect(Array.isArray(campaign.scoutQueries)).toBe(true);
    expect(campaign.scoutQueries.length).toBeGreaterThan(0);
    expect(campaign.idealProspectProfile).toBeDefined();
    expect(campaign.idealProspectProfile.summary).toBeTruthy();
    expect(campaign.idealProspectProfile.traits.length).toBeGreaterThan(0);
    expect(campaign.idealProspectProfile.disqualifiers.length).toBeGreaterThan(0);
    expect(Array.isArray(campaign.leadSchema)).toBe(true);
    expect(campaign.leadSchema.length).toBeGreaterThan(0);
    expect(campaign.deliveryMode).toBe('admin-export');
  });

  it('every campaign key matches its registry key (no copy/paste drift)', () => {
    for (const [registryKey, campaign] of entries) {
      expect(campaign.key).toBe(registryKey);
    }
  });

  it('SSDI campaign targets the 8 disability-adjacent subreddits', () => {
    const ssdi = MINE_CAMPAIGN_REGISTRY['ssdi-ticket-to-work']!;
    // Sanity check — these are the subreddits Pat Sullivan's contract relies
    // on. If a future edit drops one, this test fires before the daily mine
    // would silently miss the ICP.
    const required = ['disability', 'SSDI', 'disabilitybenefits', 'ChronicIllness',
                      'mentalhealth', 'Anxiety', 'ChronicPain', 'careerguidance'];
    for (const sub of required) {
      const found = ssdi.scoutQueries.some(q => q.toLowerCase().includes(`subreddit:${sub.toLowerCase()}`));
      expect(found, `Missing subreddit: ${sub}`).toBe(true);
    }
  });
});
