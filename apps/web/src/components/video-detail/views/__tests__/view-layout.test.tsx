import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Clock, Star } from 'lucide-react';
import { ViewLayout, LayoutRow, LayoutColumn, LayoutSection, buildPairedSection, buildPairedOrStack, renderSections } from '../ViewLayout';

describe('ViewLayout', () => {
  it('should render children', () => {
    render(
      <ViewLayout>
        <div>Content</div>
      </ViewLayout>
    );

    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('should have space-y-6 class', () => {
    const { container } = render(
      <ViewLayout>
        <div>Content</div>
      </ViewLayout>
    );

    expect(container.firstChild).toHaveClass('space-y-6');
  });

  it('should accept custom className', () => {
    const { container } = render(
      <ViewLayout className="mt-4">
        <div>Content</div>
      </ViewLayout>
    );

    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('mt-4');
  });
});

describe('LayoutRow', () => {
  it('should render children', () => {
    render(
      <LayoutRow>
        <div>Column A</div>
        <div>Column B</div>
      </LayoutRow>
    );

    expect(screen.getByText('Column A')).toBeInTheDocument();
    expect(screen.getByText('Column B')).toBeInTheDocument();
  });

  it('should have flex-col and md:flex-row classes', () => {
    const { container } = render(
      <LayoutRow>
        <div>A</div>
      </LayoutRow>
    );

    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('flex');
    expect(el.className).toContain('flex-col');
    expect(el.className).toContain('md:flex-row');
  });

  it('should apply custom gap', () => {
    const { container } = render(
      <LayoutRow gap="gap-6">
        <div>A</div>
      </LayoutRow>
    );

    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('gap-6');
  });

  it('should apply reverse class when reverse prop is true', () => {
    const { container } = render(
      <LayoutRow reverse>
        <div>A</div>
      </LayoutRow>
    );

    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('md:flex-row-reverse');
  });
});

describe('LayoutColumn', () => {
  it('should render children', () => {
    render(
      <LayoutColumn>
        <div>Content</div>
      </LayoutColumn>
    );

    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('should apply sidebar width class', () => {
    const { container } = render(
      <LayoutColumn width="sidebar">
        <div>Sidebar</div>
      </LayoutColumn>
    );

    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('md:w-[280px]');
    expect(el.className).toContain('shrink-0');
  });

  it('should apply main width class', () => {
    const { container } = render(
      <LayoutColumn width="main">
        <div>Main</div>
      </LayoutColumn>
    );

    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('flex-1');
    expect(el.className).toContain('min-w-0');
  });

  it('should default to equal width with min-w-0', () => {
    const { container } = render(
      <LayoutColumn>
        <div>Equal</div>
      </LayoutColumn>
    );

    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('flex-1');
    expect(el.className).toContain('min-w-0');
  });
});

describe('LayoutSection', () => {
  it('should render children', () => {
    render(
      <LayoutSection>
        <div>Section content</div>
      </LayoutSection>
    );

    expect(screen.getByText('Section content')).toBeInTheDocument();
  });

  it('should render SectionHeader when icon and label provided', () => {
    render(
      <LayoutSection icon={Clock} label="Timestamps">
        <div>Content</div>
      </LayoutSection>
    );

    expect(screen.getByText('Timestamps')).toBeInTheDocument();
  });

  it('should not render SectionHeader when icon or label missing', () => {
    render(
      <LayoutSection label="Test">
        <div>Content</div>
      </LayoutSection>
    );

    expect(screen.queryByText('Test')).not.toBeInTheDocument();
  });
});

describe('buildPairedSection', () => {
  it('should create a section with LayoutRow and two LayoutColumns', () => {
    const section = buildPairedSection(
      { width: 'sidebar', node: <div>Left</div> },
      { width: 'main', node: <div>Right</div> },
    );

    expect(section.key).toBe('top-row');

    const { container } = render(<div>{section.node}</div>);
    expect(screen.getByText('Left')).toBeInTheDocument();
    expect(screen.getByText('Right')).toBeInTheDocument();

    // Should have a flex row container
    const row = container.querySelector('.md\\:flex-row');
    expect(row).toBeInTheDocument();
  });

  it('should accept custom key', () => {
    const section = buildPairedSection(
      { width: 'equal', node: <div>A</div> },
      { width: 'equal', node: <div>B</div> },
      'custom-key',
    );

    expect(section.key).toBe('custom-key');
  });

  it('should apply correct column widths', () => {
    const section = buildPairedSection(
      { width: 'sidebar', node: <div>Sidebar</div> },
      { width: 'main', node: <div>Main</div> },
    );

    const { container } = render(<div>{section.node}</div>);

    const sidebarCol = container.querySelector('.md\\:w-\\[280px\\]');
    expect(sidebarCol).toBeInTheDocument();

    const mainCol = container.querySelector('.min-w-0');
    expect(mainCol).toBeInTheDocument();
  });
});

describe('buildPairedOrStack', () => {
  it('should pair both sides when both have content', () => {
    const result = buildPairedOrStack(
      { key: 'left', width: 'sidebar', node: <div>Left</div> },
      { key: 'right', width: 'main', node: <div>Right</div> },
    );

    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('top-row');

    const { container } = render(<div>{result[0].node}</div>);
    expect(screen.getByText('Left')).toBeInTheDocument();
    expect(screen.getByText('Right')).toBeInTheDocument();
    expect(container.querySelector('.md\\:flex-row')).toBeInTheDocument();
  });

  it('should return only left section when right is null', () => {
    const result = buildPairedOrStack(
      { key: 'left', width: 'sidebar', node: <div>Left Only</div> },
      { key: 'right', width: 'main', node: null },
    );

    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('left');
    render(<div>{result[0].node}</div>);
    expect(screen.getByText('Left Only')).toBeInTheDocument();
  });

  it('should return only right section when left is null', () => {
    const result = buildPairedOrStack(
      { key: 'left', width: 'sidebar', node: null },
      { key: 'right', width: 'main', node: <div>Right Only</div> },
    );

    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('right');
    render(<div>{result[0].node}</div>);
    expect(screen.getByText('Right Only')).toBeInTheDocument();
  });

  it('should return empty array when both are null', () => {
    const result = buildPairedOrStack(
      { key: 'left', width: 'sidebar', node: null },
      { key: 'right', width: 'main', node: null },
    );

    expect(result).toHaveLength(0);
  });

  it('should accept custom pair key', () => {
    const result = buildPairedOrStack(
      { key: 'a', width: 'equal', node: <div>A</div> },
      { key: 'b', width: 'equal', node: <div>B</div> },
      'custom',
    );

    expect(result[0].key).toBe('custom');
  });
});

describe('renderSections', () => {
  it('should return null for empty sections', () => {
    const result = renderSections([]);
    expect(result).toBeNull();
  });

  it('should render sections with dividers between them', () => {
    const { container } = render(
      <div>
        {renderSections([
          { key: 'a', node: <div>Section A</div> },
          { key: 'b', node: <div>Section B</div> },
          { key: 'c', node: <div>Section C</div> },
        ])}
      </div>
    );

    expect(screen.getByText('Section A')).toBeInTheDocument();
    expect(screen.getByText('Section B')).toBeInTheDocument();
    expect(screen.getByText('Section C')).toBeInTheDocument();

    // Should have 2 fade-dividers (between 3 sections)
    const dividers = container.querySelectorAll('.fade-divider');
    expect(dividers.length).toBe(2);
  });

  it('should not render divider before first section', () => {
    const { container } = render(
      <div>
        {renderSections([
          { key: 'only', node: <div>Only section</div> },
        ])}
      </div>
    );

    const dividers = container.querySelectorAll('.fade-divider');
    expect(dividers.length).toBe(0);
  });
});
