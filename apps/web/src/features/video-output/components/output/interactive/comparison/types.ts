import type { ReviewComparison } from '@vie/types';

export interface ComparisonRow extends ReviewComparison {
  winner?: 'left' | 'right' | 'tie';
}
