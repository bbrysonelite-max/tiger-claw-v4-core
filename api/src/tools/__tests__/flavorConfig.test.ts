// Tiger Claw — flavorConfig.ts unit tests
// Covers: VALID_FLAVOR_KEYS integrity, JSON file existence, loadFlavorConfig, fillTemplate

import { describe, it, expect } from 'vitest';
import {
  VALID_FLAVOR_KEYS,
  loadFlavorConfig,
  validateAllFlavors,
  listFlavors,
  fillTemplate,
} from '../flavorConfig.js';

// ─── VALID_FLAVOR_KEYS ────────────────────────────────────────────────────────
//
// Tiger Claw is a single-flavor product as of PR A (flavor shelf). The only
// customer-facing flavor is network-marketer. Hunting-only pipelines (e.g.,
// SSDI Ticket to Work) run as MineCampaigns, not flavors. Archived flavor
// configs live in api/_archive/flavors/ — see README there.

describe('VALID_FLAVOR_KEYS', () => {
  it('contains exactly 1 customer-facing flavor (network-marketer)', () => {
    expect(VALID_FLAVOR_KEYS).toHaveLength(1);
    expect(VALID_FLAVOR_KEYS).toContain('network-marketer');
  });

  it('does not include admin (internal-only, never provisioned)', () => {
    expect(VALID_FLAVOR_KEYS).not.toContain('admin');
  });

  it('does not include archived flavors', () => {
    const archived = [
      'real-estate', 'health-wellness', 'airbnb-host', 'lawyer',
      'plumber', 'sales-tiger', 'mortgage-broker', 'researcher',
      'baker', 'candle-maker', 'doctor', 'dorm-design', 'gig-economy',
      'interior-designer', 'personal-trainer',
      'director-of-operations', 'intelligence-specialist',
    ];
    for (const key of archived) {
      expect(VALID_FLAVOR_KEYS).not.toContain(key);
    }
  });
});

// ─── validateAllFlavors ───────────────────────────────────────────────────────

describe('validateAllFlavors', () => {
  it('returns valid:true — network-marketer is present', () => {
    const result = validateAllFlavors();
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('reports exactly 1 loaded customer-facing flavor', () => {
    const result = validateAllFlavors();
    expect(result.loaded).toHaveLength(1);
    expect(result.loaded).toContain('network-marketer');
  });

  it('loaded list contains every key in VALID_FLAVOR_KEYS', () => {
    const result = validateAllFlavors();
    for (const key of VALID_FLAVOR_KEYS) {
      expect(result.loaded).toContain(key);
    }
  });
});

// ─── loadFlavorConfig ─────────────────────────────────────────────────────────

describe('loadFlavorConfig', () => {
  it('loads network-marketer config with all required template keys', () => {
    const config = loadFlavorConfig('network-marketer');
    expect(config.key).toBeDefined();
    expect(config.nurtureTemplates).toBeDefined();
    expect(config.nurtureTemplates.default_fallback).toBeTruthy();
    expect(config.nurtureTemplates.value_drop).toBeTruthy();
    expect(config.nurtureTemplates.gap_closing).toBeTruthy();
  });

  it.each([...VALID_FLAVOR_KEYS])('loads %s without crashing', (flavor) => {
    const config = loadFlavorConfig(flavor);
    expect(config).toBeDefined();
    expect(config.nurtureTemplates).toBeDefined();
    expect(config.nurtureTemplates.default_fallback).toBeTruthy();
  });

  it('falls back gracefully for an unknown flavor key', () => {
    const config = loadFlavorConfig('unknown-flavor-xyz-9999');
    // Must not crash — falls back to network-marketer or hardcoded fallback
    expect(config).toBeDefined();
    expect(config.nurtureTemplates).toBeDefined();
  });
});

// ─── listFlavors ──────────────────────────────────────────────────────────────

describe('listFlavors', () => {
  it('returns exactly 2 registry entries (network-marketer + admin)', () => {
    const flavors = listFlavors();
    expect(flavors).toHaveLength(2);
    expect(flavors).toContain('network-marketer');
    expect(flavors).toContain('admin');
  });

  it('does not include archived flavors', () => {
    const flavors = listFlavors();
    expect(flavors).not.toContain('mortgage-broker');
    expect(flavors).not.toContain('real-estate');
    expect(flavors).not.toContain('lawyer');
  });
});

// ─── fillTemplate ─────────────────────────────────────────────────────────────

describe('fillTemplate', () => {
  it('replaces a single variable', () => {
    expect(fillTemplate('Hello {{name}}', { name: 'Sarah' })).toBe('Hello Sarah');
  });

  it('replaces multiple occurrences of the same variable', () => {
    expect(fillTemplate('{{name}}, nice to meet you {{name}}!', { name: 'Bob' }))
      .toBe('Bob, nice to meet you Bob!');
  });

  it('replaces multiple distinct variables', () => {
    expect(fillTemplate('{{greeting}} {{name}}', { greeting: 'Hey', name: 'Alice' }))
      .toBe('Hey Alice');
  });

  it('replaces explicit undefined value with empty string', () => {
    expect(fillTemplate('Hello {{name}}', { name: undefined })).toBe('Hello ');
  });

  it('leaves placeholder unchanged when variable key is absent from map', () => {
    expect(fillTemplate('Hello {{name}}', {})).toBe('Hello {{name}}');
  });

  it('does not alter template when variables map is empty', () => {
    const t = 'Static text no placeholders';
    expect(fillTemplate(t, {})).toBe(t);
  });
});
