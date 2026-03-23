import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';


import { CodeExplorer } from '../CodeExplorer';

const snippets = [
  { language: 'python', code: 'print("hello")', explanation: 'Basic print statement', filename: 'main.py' },
  { language: 'javascript', code: 'console.log("hi")', explanation: 'Console logging' },
];

describe('CodeExplorer', () => {
  it('should render the first snippet in navigate mode', () => {
    render(<CodeExplorer snippets={snippets} />);
    expect(screen.getByText('print("hello")')).toBeInTheDocument();
    expect(screen.getByText('Basic print statement')).toBeInTheDocument();
    expect(screen.getByText('main.py')).toBeInTheDocument();
  });

  it('should return null for empty snippets', () => {
    const { container } = render(<CodeExplorer snippets={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('should show language badge', () => {
    render(<CodeExplorer snippets={snippets} />);
    expect(screen.getByText('python')).toBeInTheDocument();
  });

  it('should toggle between navigate and showAll', () => {
    render(<CodeExplorer snippets={snippets} />);
    // Initially in navigate mode - only first snippet visible
    expect(screen.getByText('print("hello")')).toBeInTheDocument();
    expect(screen.queryByText('console.log("hi")')).not.toBeInTheDocument();

    // Click "Show all"
    fireEvent.click(screen.getByText('Show all'));
    expect(screen.getByText('print("hello")')).toBeInTheDocument();
    expect(screen.getByText('console.log("hi")')).toBeInTheDocument();
  });
});
