import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TabCoordinationProvider, useTabCoordination } from '../TabCoordinationContext';

function TestConsumer() {
  const { activeTab, setActiveTab, completedTabs, markTabCompleted } = useTabCoordination();
  return (
    <div>
      <span data-testid="active-tab">{activeTab}</span>
      <span data-testid="completed-count">{completedTabs.size}</span>
      <span data-testid="completed-list">{Array.from(completedTabs).join(',')}</span>
      <button onClick={() => setActiveTab('quiz')}>Go to quiz</button>
      <button onClick={() => markTabCompleted('overview')}>Complete overview</button>
    </div>
  );
}

describe('TabCoordinationContext', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('should provide initial active tab', () => {
    render(
      <TabCoordinationProvider videoId="v1" initialTab="overview">
        <TestConsumer />
      </TabCoordinationProvider>
    );

    expect(screen.getByTestId('active-tab')).toHaveTextContent('overview');
  });

  it('should update active tab', () => {
    render(
      <TabCoordinationProvider videoId="v1" initialTab="overview">
        <TestConsumer />
      </TabCoordinationProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /go to quiz/i }));

    expect(screen.getByTestId('active-tab')).toHaveTextContent('quiz');
  });

  it('should track completed tabs', () => {
    render(
      <TabCoordinationProvider videoId="v1" initialTab="overview">
        <TestConsumer />
      </TabCoordinationProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /complete overview/i }));

    expect(screen.getByTestId('completed-count')).toHaveTextContent('1');
    expect(screen.getByTestId('completed-list')).toHaveTextContent('overview');
  });

  it('should not duplicate completed tabs', () => {
    render(
      <TabCoordinationProvider videoId="v1" initialTab="overview">
        <TestConsumer />
      </TabCoordinationProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /complete overview/i }));
    fireEvent.click(screen.getByRole('button', { name: /complete overview/i }));

    expect(screen.getByTestId('completed-count')).toHaveTextContent('1');
  });

  it('should persist completed tabs in sessionStorage', () => {
    const { unmount } = render(
      <TabCoordinationProvider videoId="v1" initialTab="overview">
        <TestConsumer />
      </TabCoordinationProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /complete overview/i }));
    unmount();

    // Re-render should load from sessionStorage
    render(
      <TabCoordinationProvider videoId="v1" initialTab="overview">
        <TestConsumer />
      </TabCoordinationProvider>
    );

    expect(screen.getByTestId('completed-count')).toHaveTextContent('1');
  });

  it('should isolate storage by videoId', () => {
    const { unmount } = render(
      <TabCoordinationProvider videoId="v1" initialTab="overview">
        <TestConsumer />
      </TabCoordinationProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /complete overview/i }));
    unmount();

    // Different videoId should start fresh
    render(
      <TabCoordinationProvider videoId="v2" initialTab="overview">
        <TestConsumer />
      </TabCoordinationProvider>
    );

    expect(screen.getByTestId('completed-count')).toHaveTextContent('0');
  });

  it('should throw when used outside provider', () => {
    // Suppress console error for the expected throw
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<TestConsumer />)).toThrow(
      'useTabCoordination must be used within a TabCoordinationProvider'
    );

    spy.mockRestore();
  });
});
