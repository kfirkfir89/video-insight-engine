import { describe, it, expect } from 'vitest';
import { cn } from '../utils';

describe('utils', () => {
  // ─────────────────────────────────────────────────────
  // cn (class name merging) Tests
  // ─────────────────────────────────────────────────────

  describe('cn', () => {
    describe('basic class merging', () => {
      it('should merge multiple class strings', () => {
        expect(cn('class1', 'class2')).toBe('class1 class2');
      });

      it('should handle single class', () => {
        expect(cn('single-class')).toBe('single-class');
      });

      it('should return empty string for no arguments', () => {
        expect(cn()).toBe('');
      });

      it('should handle empty strings', () => {
        expect(cn('class1', '', 'class2')).toBe('class1 class2');
      });
    });

    describe('conditional classes', () => {
      it('should include class when condition is true', () => {
        expect(cn('base', true && 'conditional')).toBe('base conditional');
      });

      it('should exclude class when condition is false', () => {
        expect(cn('base', false && 'conditional')).toBe('base');
      });

      it('should handle undefined values', () => {
        expect(cn('base', undefined, 'other')).toBe('base other');
      });

      it('should handle null values', () => {
        expect(cn('base', null, 'other')).toBe('base other');
      });
    });

    describe('object syntax', () => {
      it('should include classes with truthy values', () => {
        expect(cn({ active: true, disabled: false })).toBe('active');
      });

      it('should handle all true values', () => {
        expect(cn({ one: true, two: true })).toBe('one two');
      });

      it('should handle all false values', () => {
        expect(cn({ one: false, two: false })).toBe('');
      });

      it('should combine object and string syntax', () => {
        expect(cn('base', { active: true })).toBe('base active');
      });
    });

    describe('array syntax', () => {
      it('should flatten arrays', () => {
        expect(cn(['class1', 'class2'])).toBe('class1 class2');
      });

      it('should handle nested arrays', () => {
        expect(cn(['class1', ['class2', 'class3']])).toBe('class1 class2 class3');
      });

      it('should handle mixed array content', () => {
        expect(cn(['base', false && 'hidden', { active: true }])).toBe('base active');
      });
    });

    describe('tailwind merge (conflicting classes)', () => {
      it('should merge conflicting padding classes', () => {
        expect(cn('p-4', 'p-2')).toBe('p-2');
      });

      it('should merge conflicting margin classes', () => {
        expect(cn('m-4', 'm-8')).toBe('m-8');
      });

      it('should merge conflicting width classes', () => {
        expect(cn('w-full', 'w-1/2')).toBe('w-1/2');
      });

      it('should merge conflicting text color classes', () => {
        expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
      });

      it('should merge conflicting background color classes', () => {
        expect(cn('bg-white', 'bg-black')).toBe('bg-black');
      });

      it('should merge conflicting font size classes', () => {
        expect(cn('text-sm', 'text-lg')).toBe('text-lg');
      });

      it('should preserve non-conflicting classes', () => {
        expect(cn('p-4 text-red-500', 'm-2')).toBe('p-4 text-red-500 m-2');
      });

      it('should handle responsive prefixes', () => {
        expect(cn('md:p-4', 'md:p-8')).toBe('md:p-8');
      });

      it('should handle state prefixes', () => {
        expect(cn('hover:bg-blue-500', 'hover:bg-red-500')).toBe('hover:bg-red-500');
      });
    });

    describe('real-world usage patterns', () => {
      it('should handle typical component pattern', () => {
        const isActive = true;
        const isDisabled = false;
        const className = 'custom-class';

        const result = cn(
          'base-styles px-4 py-2',
          isActive && 'active-styles',
          isDisabled && 'disabled-styles',
          className
        );

        expect(result).toBe('base-styles px-4 py-2 active-styles custom-class');
      });

      it('should handle variant pattern', () => {
        const variant = 'primary';
        const variants = {
          primary: 'bg-blue-500 text-white',
          secondary: 'bg-gray-200 text-gray-800',
        };

        const result = cn('btn', variants[variant as keyof typeof variants]);

        expect(result).toBe('btn bg-blue-500 text-white');
      });

      it('should handle size pattern with override', () => {
        const baseClasses = 'p-4 text-base';
        const sizeOverride = 'p-2 text-sm';

        const result = cn(baseClasses, sizeOverride);

        expect(result).toBe('p-2 text-sm');
      });

      it('should handle disabled state override', () => {
        const result = cn(
          'bg-blue-500 hover:bg-blue-600 cursor-pointer',
          true && 'bg-gray-300 hover:bg-gray-300 cursor-not-allowed'
        );

        expect(result).toBe('bg-gray-300 hover:bg-gray-300 cursor-not-allowed');
      });
    });

    describe('edge cases', () => {
      it('should handle many arguments', () => {
        const result = cn('a', 'b', 'c', 'd', 'e', 'f', 'g');
        expect(result).toBe('a b c d e f g');
      });

      it('should handle deeply nested structures', () => {
        const result = cn([[[['deep']]]], { nested: true });
        expect(result).toBe('deep nested');
      });

      it('should handle whitespace in class names', () => {
        expect(cn('  spaced  ', 'class')).toBe('spaced class');
      });

      it('should handle numbers (converts to string)', () => {
        expect(cn('class', 0)).toBe('class');
      });
    });
  });
});
