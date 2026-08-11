import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingValueProps } from '../OnboardingValueProps';
import { ExampleDisclosure } from '../ExampleDisclosure';
import { SAMPLE_VIDEO } from '@/features/video-output/lib/onboarding-constants';
import { isYouTubeUrl, hasVideoId } from '@/lib/youtube-utils';

describe('OnboardingValueProps', () => {
  it('should render the section labelled "you\'ll get"', () => {
    render(<OnboardingValueProps />);
    const section = screen.getByRole('region', { name: /you'll get/i });
    expect(section).toBeInTheDocument();
  });

  it('should render every advertised value chip', () => {
    render(<OnboardingValueProps />);
    const expected = [
      'Summary',
      'Timestamps',
      'Flashcards',
      'Quiz',
      'Q&A',
      'Translation',
    ];
    for (const label of expected) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('should render chips as a list with one item per chip', () => {
    render(<OnboardingValueProps />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(6);
  });
});

describe('ExampleDisclosure', () => {
  it('should render collapsed by default', () => {
    render(<ExampleDisclosure />);
    const trigger = screen.getByRole('button', { name: /see an example/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('should expand when the trigger is clicked', async () => {
    const user = userEvent.setup();
    render(<ExampleDisclosure />);

    const trigger = screen.getByRole('button', { name: /see an example/i });
    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('should toggle back to collapsed on a second click', async () => {
    const user = userEvent.setup();
    render(<ExampleDisclosure />);

    const trigger = screen.getByRole('button', { name: /see an example/i });
    await user.click(trigger);
    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('should reference its panel via aria-controls', () => {
    render(<ExampleDisclosure />);
    const trigger = screen.getByRole('button', { name: /see an example/i });
    expect(trigger).toHaveAttribute('aria-controls', 'example-disclosure-panel');
    expect(document.getElementById('example-disclosure-panel')).toBeInTheDocument();
  });
});

describe('SAMPLE_VIDEO constant', () => {
  it('should be a valid YouTube watch URL with a video id', () => {
    expect(isYouTubeUrl(SAMPLE_VIDEO.url)).toBe(true);
    expect(hasVideoId(SAMPLE_VIDEO.url)).toBe(true);
  });

  it('should expose a non-empty human-readable label', () => {
    expect(SAMPLE_VIDEO.label.length).toBeGreaterThan(0);
  });
});
