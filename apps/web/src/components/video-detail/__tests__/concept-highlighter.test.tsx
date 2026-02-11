import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConceptHighlighter } from '../ConceptHighlighter';
import { ConceptsProvider } from '../ConceptsContext';
import type { Concept } from '@vie/types';

function makeConcept(overrides: Partial<Concept> = {}): Concept {
  return {
    id: 'c-1',
    name: 'Machine Learning',
    definition: 'A branch of AI',
    timestamp: null,
    ...overrides,
  };
}

function renderWithConcepts(text: string, concepts: Concept[]) {
  return render(
    <ConceptsProvider concepts={concepts}>
      <ConceptHighlighter text={text} />
    </ConceptsProvider>
  );
}

describe('ConceptHighlighter', () => {
  describe('basic matching', () => {
    it('should render plain text when no concepts are provided', () => {
      renderWithConcepts('Hello world', []);
      expect(screen.getByText('Hello world')).toBeInTheDocument();
    });

    it('should render plain text when text has no matches', () => {
      renderWithConcepts('No matches here', [makeConcept()]);
      expect(screen.getByText('No matches here')).toBeInTheDocument();
    });

    it('should highlight a matching concept', () => {
      renderWithConcepts('Learn about Machine Learning today', [makeConcept()]);
      expect(screen.getByRole('button', { name: 'Definition: Machine Learning' })).toBeInTheDocument();
    });

    it('should match case-insensitively', () => {
      renderWithConcepts('I study machine learning daily', [makeConcept()]);
      expect(screen.getByRole('button', { name: 'Definition: Machine Learning' })).toBeInTheDocument();
    });

    it('should match concept at start of text', () => {
      renderWithConcepts('Machine Learning is great', [makeConcept()]);
      expect(screen.getByRole('button', { name: 'Definition: Machine Learning' })).toBeInTheDocument();
    });

    it('should match concept at end of text', () => {
      renderWithConcepts('I love Machine Learning', [makeConcept()]);
      expect(screen.getByRole('button', { name: 'Definition: Machine Learning' })).toBeInTheDocument();
    });

    it('should match concept after punctuation', () => {
      renderWithConcepts('What is Machine Learning?', [makeConcept()]);
      expect(screen.getByRole('button', { name: 'Definition: Machine Learning' })).toBeInTheDocument();
    });

    it('should not match concept embedded in a word', () => {
      const concept = makeConcept({ name: 'API' });
      renderWithConcepts('The CAPItal of France', [concept]);
      // Should render as plain text, no button
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('accented characters', () => {
    it('should match accented concept names', () => {
      const concept = makeConcept({ name: 'Pao de Queijo', definition: 'Brazilian cheese bread' });
      renderWithConcepts('Try Pao de Queijo today', [concept]);
      expect(screen.getByRole('button', { name: 'Definition: Pao de Queijo' })).toBeInTheDocument();
    });

    it('should match concept with accented chars next to punctuation', () => {
      const concept = makeConcept({ name: 'Creme Brulee', definition: 'French dessert' });
      renderWithConcepts('Serve Creme Brulee.', [concept]);
      expect(screen.getByRole('button', { name: 'Definition: Creme Brulee' })).toBeInTheDocument();
    });
  });

  describe('abbreviation extraction', () => {
    it('should match abbreviation from parentheses', () => {
      const concept = makeConcept({ name: 'Search Engine Optimization (SEO)' });
      renderWithConcepts('Learn SEO basics', [concept]);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should match base name without parenthetical', () => {
      const concept = makeConcept({ name: 'Search Engine Optimization (SEO)' });
      renderWithConcepts('Learn about Search Engine Optimization', [concept]);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  describe('slash separator', () => {
    it('should match each part of a slash-separated concept', () => {
      const concept = makeConcept({ name: 'Reputation Lists / Spam Houses' });
      renderWithConcepts('Check the Reputation Lists first', [concept]);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should match second part of slash-separated concept', () => {
      const concept = makeConcept({ name: 'Reputation Lists / Spam Houses' });
      renderWithConcepts('Avoid Spam Houses at all costs', [concept]);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  describe('plural generation', () => {
    it('should match plural form of a concept', () => {
      const concept = makeConcept({ name: 'Neural Network' });
      renderWithConcepts('Train Neural Networks with data', [concept]);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should not generate plural for words ending in s', () => {
      const concept = makeConcept({ name: 'DNS' });
      renderWithConcepts('Configure DNS settings', [concept]);
      // Should match the original "DNS", not generate "DNSs"
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should not generate plural for words ending in x', () => {
      const concept = makeConcept({ name: 'Redux' });
      renderWithConcepts('Use Redux for state', [concept]);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should not generate plural for words ending in z', () => {
      const concept = makeConcept({ name: 'Topaz' });
      renderWithConcepts('A Topaz gemstone', [concept]);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  describe('longest-first matching', () => {
    it('should match longer concept before shorter overlap', () => {
      const concepts = [
        makeConcept({ id: 'c-1', name: 'Machine Learning' }),
        makeConcept({ id: 'c-2', name: 'Machine Learning Pipeline' }),
      ];
      renderWithConcepts('Build a Machine Learning Pipeline', concepts);
      expect(screen.getByRole('button', { name: 'Definition: Machine Learning Pipeline' })).toBeInTheDocument();
    });
  });

  describe('multiple concepts', () => {
    it('should highlight multiple different concepts in same text', () => {
      const concepts = [
        makeConcept({ id: 'c-1', name: 'API' }),
        makeConcept({ id: 'c-2', name: 'REST' }),
      ];
      renderWithConcepts('Build a REST API today', concepts);
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(2);
    });
  });

  describe('popover content', () => {
    it('should show definition in popover trigger aria-label', () => {
      renderWithConcepts('Learn Machine Learning', [makeConcept()]);
      expect(screen.getByRole('button', { name: 'Definition: Machine Learning' })).toBeInTheDocument();
    });

    it('should render without concepts context (graceful fallback)', () => {
      // Without provider — useConcepts returns []
      render(<ConceptHighlighter text="Plain text" />);
      expect(screen.getByText('Plain text')).toBeInTheDocument();
    });
  });

  describe('special characters in concept names', () => {
    it('should handle concept names with dots', () => {
      const concept = makeConcept({ name: 'Node.js' });
      renderWithConcepts('Learn Node.js basics', [concept]);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should handle concept names with plus signs', () => {
      const concept = makeConcept({ name: 'C++' });
      renderWithConcepts('Write C++ code', [concept]);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should handle concept names with hyphens', () => {
      const concept = makeConcept({ name: 'real-time' });
      renderWithConcepts('Build real-time apps', [concept]);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle empty text', () => {
      const { container } = renderWithConcepts('', [makeConcept()]);
      expect(container.textContent).toBe('');
    });

    it('should handle concept with empty name', () => {
      const concept = makeConcept({ name: '' });
      renderWithConcepts('Some text', [concept]);
      expect(screen.getByText('Some text')).toBeInTheDocument();
    });

    it('should handle text that is only the concept', () => {
      renderWithConcepts('Machine Learning', [makeConcept()]);
      expect(screen.getByRole('button', { name: 'Definition: Machine Learning' })).toBeInTheDocument();
    });
  });
});
