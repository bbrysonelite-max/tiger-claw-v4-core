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

describe('VALID_FLAVOR_KEYS', () => {
  it('contains exactly 8 customer-facing flavors', () => {
    expect(VALID_FLAVOR_KEYS).toHaveLength(8);
  });

  it('does not include admin (internal-only, never provisioned)', () => {
    expect(VALID_FLAVOR_KEYS).not.toContain('admin');
  });

  it('does not include removed invalid flavor: director-of-operations', () => {
    expect(VALID_FLAVOR_KEYS).not.toContain('director-of-operations');
  });

  it('does not include removed invalid flavor: intelligence-specialist', () => {
    expect(VALID_FLAVOR_KEYS).not.toContain('intelligence-specialist');
  });

  it('does not include removed flavor: doctor (healthcare compliance risk)', () => {
    expect(VALID_FLAVOR_KEYS).not.toContain('doctor');
  });

  it('includes all 9 expected valid flavor keys', () => {
    const expected = [
      'network-marketer',
      'real-estate',
      'health-wellness',
      'airbnb-host',
      'lawyer',
      'plumber',
      'sales-tiger',
      'mortgage-broker',
    ];
    for (const key of expected) {
      expect(VALID_FLAVOR_KEYS).toContain(key);
    }
  });
});

// ─── validateAllFlavors ───────────────────────────────────────────────────────

describe('validateAllFlavors', () => {
  it('returns valid:true — all flavor files are present', () => {
    const result = validateAllFlavors();
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('reports 8 loaded flavors', () => {
    const result = validateAllFlavors();
    expect(result.loaded).toHaveLength(8);
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
  it('returns at least 9 flavor IDs (registry includes internal flavors)', () => {
    const flavors = listFlavors();
    expect(flavors.length).toBeGreaterThanOrEqual(9);
  });

  it('includes network-marketer', () => {
    expect(listFlavors()).toContain('network-marketer');
  });

  it('includes mortgage-broker', () => {
    const flavors = listFlavors();
    expect(flavors).toContain('mortgage-broker');
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
