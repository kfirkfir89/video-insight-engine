import { describe, it, expect, beforeEach } from 'vitest';
import {
  incrementTelemetryCounter,
  getTelemetryCounter,
  getTelemetryCounters,
  resetTelemetryCounters,
} from '@/features/video-output/lib/telemetry';

describe('telemetry counters', () => {
  beforeEach(() => {
    resetTelemetryCounters();
  });

  it('should create a counter at 1 on first increment', () => {
    incrementTelemetryCounter('tab_prop_drift');
    expect(getTelemetryCounter('tab_prop_drift')).toBe(1);
  });

  it('should increment an existing counter', () => {
    incrementTelemetryCounter('tab_prop_drift');
    incrementTelemetryCounter('tab_prop_drift');
    incrementTelemetryCounter('tab_prop_drift');
    expect(getTelemetryCounter('tab_prop_drift')).toBe(3);
  });

  it('should return 0 for a counter that never incremented', () => {
    expect(getTelemetryCounter('never_touched')).toBe(0);
  });

  it('should snapshot all counters', () => {
    incrementTelemetryCounter('a');
    incrementTelemetryCounter('b');
    incrementTelemetryCounter('b');
    expect(getTelemetryCounters()).toEqual({ a: 1, b: 2 });
  });

  it('should expose the live counter map on window for prod inspection', () => {
    incrementTelemetryCounter('tab_prop_drift');
    expect(window.__vieTelemetry?.tab_prop_drift).toBe(1);
  });

  it('should clear counters on reset', () => {
    incrementTelemetryCounter('x');
    resetTelemetryCounters();
    expect(getTelemetryCounter('x')).toBe(0);
    expect(getTelemetryCounters()).toEqual({});
  });
});
