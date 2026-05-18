/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect } from 'vitest';
import { render, screen, renderHook } from '@testing-library/react';
import { DirectionProvider, useDirection } from '../DirectionContext';

describe('DirectionProvider', () => {
  it('should default to ltr when isRTL is omitted', () => {
    render(
      <DirectionProvider language="en">
        <span data-testid="content">hello</span>
      </DirectionProvider>,
    );
    const wrapper = screen.getByTestId('content').parentElement;
    expect(wrapper).not.toHaveAttribute('dir', 'rtl');
  });

  it('should render dir="rtl" wrapper when isRTL is true', () => {
    render(
      <DirectionProvider language="he" isRTL>
        <span data-testid="content">שלום</span>
      </DirectionProvider>,
    );
    const wrapper = screen.getByTestId('content').parentElement;
    expect(wrapper).toHaveAttribute('dir', 'rtl');
  });

  it('should expose direction/isRTL/language via useDirection', () => {
    const { result } = renderHook(() => useDirection(), {
      wrapper: ({ children }) => (
        <DirectionProvider language="ar" isRTL>
          {children}
        </DirectionProvider>
      ),
    });
    expect(result.current.direction).toBe('rtl');
    expect(result.current.isRTL).toBe(true);
    expect(result.current.language).toBe('ar');
  });

  it('should expose ltr defaults outside any provider', () => {
    const { result } = renderHook(() => useDirection());
    expect(result.current.direction).toBe('ltr');
    expect(result.current.isRTL).toBe(false);
    expect(result.current.language).toBe('en');
  });

  it('should keep the wrapper as ltr when isRTL is false for an RTL language code', () => {
    // The provider trusts the explicit isRTL flag over inferring from the
    // language string — keeps the wiring data-driven from the pipeline.
    render(
      <DirectionProvider language="he" isRTL={false}>
        <span data-testid="content">hello</span>
      </DirectionProvider>,
    );
    const wrapper = screen.getByTestId('content').parentElement;
    expect(wrapper).not.toHaveAttribute('dir', 'rtl');
  });
});
