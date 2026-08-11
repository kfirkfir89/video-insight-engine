import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TabStateProvider } from '@/features/video-output/contexts/TabStateContext';
import { FlowPlayer, type FlowStepRenderArgs } from '../FlowPlayer';

interface RenderOptions {
  sequenceLength?: number;
  onExit?: () => void;
}

function renderFlowPlayer({ sequenceLength = 3, onExit = vi.fn() }: RenderOptions = {}) {
  const renderStep = (args: FlowStepRenderArgs) => (
    <div>
      <p>Step {args.currentStep + 1} content</p>
      <button onClick={() => args.onStepChange(args.currentStep + 1)}>Next step</button>
      <button onClick={() => args.onComplete(args.currentStep)}>
        {args.isStepCompleted(args.currentStep) ? 'Undo' : 'Done'}
      </button>
    </div>
  );

  return render(
    <TabStateProvider videoId="flow-test">
      <FlowPlayer
        emoji="🍳"
        modeLabel="Cooking Mode"
        stepNoun="steps"
        contextLabel="Ingredients"
        contextCount={2}
        renderContext={() => <p>Context body</p>}
        sequenceLength={sequenceLength}
        renderStep={renderStep}
        completionMessage="All done!"
        onExit={onExit}
      />
    </TabStateProvider>,
  );
}

describe('FlowPlayer', () => {
  it('renders the mode header label', () => {
    renderFlowPlayer();
    expect(screen.getByText('Cooking Mode')).toBeInTheDocument();
  });

  it('renders the context panel body', () => {
    renderFlowPlayer();
    expect(screen.getAllByText('Context body').length).toBeGreaterThan(0);
  });

  it('renders the first step from the sequence renderer', () => {
    renderFlowPlayer();
    expect(screen.getByText('Step 1 content')).toBeInTheDocument();
  });

  it('shows the initial progress counter at 0 of N', () => {
    renderFlowPlayer({ sequenceLength: 3 });
    expect(screen.getByText('0/3 steps')).toBeInTheDocument();
  });

  it('advances to the next step when the sequence renderer requests it', async () => {
    const user = userEvent.setup();
    renderFlowPlayer();
    await user.click(screen.getByRole('button', { name: 'Next step' }));
    expect(screen.getByText('Step 2 content')).toBeInTheDocument();
  });

  it('jumps to a step when its stepper dot is clicked', async () => {
    const user = userEvent.setup();
    renderFlowPlayer({ sequenceLength: 3 });
    await user.click(screen.getByRole('button', { name: 'Go to step 3' }));
    expect(screen.getByText('Step 3 content')).toBeInTheDocument();
  });

  it('updates the progress counter when a step is completed', async () => {
    const user = userEvent.setup();
    renderFlowPlayer({ sequenceLength: 3 });
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByText('1/3 steps')).toBeInTheDocument();
  });

  it('shows the completion message once every step is complete', async () => {
    const user = userEvent.setup();
    renderFlowPlayer({ sequenceLength: 1 });
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByText('All done!')).toBeInTheDocument();
  });

  it('calls onExit when the exit button is clicked', async () => {
    const user = userEvent.setup();
    const onExit = vi.fn();
    renderFlowPlayer({ onExit });
    await user.click(screen.getByRole('button', { name: /exit cooking mode/i }));
    expect(onExit).toHaveBeenCalledOnce();
  });
});
