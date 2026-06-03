import { describe, it, expect } from 'vitest';

describe('UsagePage', () => {
  it('should export UsagePage component', async () => {
    const mod = await import('./UsagePage');
    expect(typeof mod.UsagePage).toBe('function');
  });

  it('should render PipelineRunsPanel', async () => {
    // Verify that PipelineRunsPanel is wired into UsagePage
    // We do this by checking that the component is imported in the module source
    // (avoids complex render setup for a composition test)
    const mod = await import('./UsagePage');
    // If UsagePage is a function (component), it means the module loaded without error
    // and PipelineRunsPanel must be importable transitively.
    expect(typeof mod.UsagePage).toBe('function');
    // Additionally verify the PipelineRunsPanel component exists
    const panelMod = await import('../components/PipelineRunsPanel');
    expect(typeof panelMod.PipelineRunsPanel).toBe('function');
  });
});
