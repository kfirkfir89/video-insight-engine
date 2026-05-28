/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageToggle } from '../LanguageToggle';

describe('LanguageToggle', () => {
  it('renders the native-script label and English pill as radios', () => {
    render(
      <LanguageToggle
        showOriginal={false}
        onChange={vi.fn()}
        originalName="العربية"
        originalCode="ar"
      />,
    );
    expect(screen.getByRole('radio', { name: 'العربية' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'English' })).toBeInTheDocument();
  });

  it('exposes a radiogroup with a localized aria-label', () => {
    render(
      <LanguageToggle
        showOriginal={false}
        onChange={vi.fn()}
        originalName="עברית"
        originalCode="he"
      />,
    );
    // DirectionContext defaults to English in test render — the label is
    // the EN translation. The point of this test is that the group is a
    // radiogroup with a label that comes from useLabels(), not a hardcoded
    // string.
    expect(screen.getByRole('radiogroup', { name: /content language/i })).toBeInTheDocument();
  });

  it('marks English checked by default and uses roving tabindex', () => {
    render(
      <LanguageToggle
        showOriginal={false}
        onChange={vi.fn()}
        originalName="עברית"
        originalCode="he"
      />,
    );
    const english = screen.getByRole('radio', { name: 'English' });
    const original = screen.getByRole('radio', { name: 'עברית' });
    expect(english).toHaveAttribute('aria-checked', 'true');
    expect(original).toHaveAttribute('aria-checked', 'false');
    expect(english).toHaveAttribute('tabindex', '0');
    expect(original).toHaveAttribute('tabindex', '-1');
  });

  it('marks the original radio checked when showOriginal is true', () => {
    render(
      <LanguageToggle
        showOriginal={true}
        onChange={vi.fn()}
        originalName="עברית"
        originalCode="he"
      />,
    );
    const english = screen.getByRole('radio', { name: 'English' });
    const original = screen.getByRole('radio', { name: 'עברית' });
    expect(english).toHaveAttribute('aria-checked', 'false');
    expect(original).toHaveAttribute('aria-checked', 'true');
    expect(english).toHaveAttribute('tabindex', '-1');
    expect(original).toHaveAttribute('tabindex', '0');
  });

  it('calls onChange(true) when the original radio is clicked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <LanguageToggle
        showOriginal={false}
        onChange={onChange}
        originalName="中文"
        originalCode="zh"
      />,
    );
    await user.click(screen.getByRole('radio', { name: '中文' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('calls onChange(false) when the English radio is clicked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <LanguageToggle
        showOriginal={true}
        onChange={onChange}
        originalName="العربية"
        originalCode="ar"
      />,
    );
    await user.click(screen.getByRole('radio', { name: 'English' }));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('sets the lang attribute on each pill so screen readers pick the right voice', () => {
    render(
      <LanguageToggle
        showOriginal={false}
        onChange={vi.fn()}
        originalName="日本語"
        originalCode="JA"
      />,
    );
    const japanese = screen.getByRole('radio', { name: '日本語' });
    const english = screen.getByRole('radio', { name: 'English' });
    expect(japanese).toHaveAttribute('lang', 'ja');
    expect(english).toHaveAttribute('lang', 'en');
  });

  it('falls back to "und" when originalCode is empty (regression guard for null payloads)', () => {
    // The backend type says `code: string` but a regression that ships an
    // empty or null code shouldn't crash the page — the toggle stays useful
    // and assistive tech gets a valid (if generic) lang attribute.
    render(
      <LanguageToggle
        showOriginal={false}
        onChange={vi.fn()}
        originalName="Unknown"
        originalCode=""
      />,
    );
    expect(screen.getByRole('radio', { name: 'Unknown' })).toHaveAttribute('lang', 'und');
  });

  it('moves selection with arrow keys (radiogroup pattern)', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <LanguageToggle
        showOriginal={false}
        onChange={onChange}
        originalName="עברית"
        originalCode="he"
      />,
    );
    const english = screen.getByRole('radio', { name: 'English' });
    english.focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith(true);
    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith(false);
  });
});
