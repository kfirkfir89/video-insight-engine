import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { TechSnippet } from '@vie/types';

import { CodePlayground } from '../CodePlayground';

const jsSnippets = [
  {
    language: 'javascript',
    code: 'console.log("hello")',
    explanation: 'Logs a greeting',
    filename: 'hello.js',
  },
  {
    language: 'typescript',
    code: 'const x: number = 1;',
    explanation: 'Declare a number',
  },
];

const pythonSnippet = [
  {
    language: 'python',
    code: 'print("hi")',
    explanation: 'Python print',
  },
];

describe('CodePlayground', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('should render snippet code', () => {
    render(<CodePlayground snippets={jsSnippets} />);
    expect(screen.getByText('Logs a greeting')).toBeInTheDocument();
    expect(screen.getByText('hello.js')).toBeInTheDocument();
  });

  it('renders an empty state for empty snippets', () => {
    const { container } = render(<CodePlayground snippets={[]} />);
    expect(container.textContent).toContain('No code snippets were extracted');
  });

  it('should copy snippet code to clipboard when Copy is clicked', async () => {
    render(<CodePlayground snippets={jsSnippets} />);
    const copyBtn = screen.getByRole('button', { name: /copy/i });
    await act(async () => {
      fireEvent.click(copyBtn);
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('console.log("hello")');
  });

  it('should hide Run button for non-runnable languages like python', () => {
    render(<CodePlayground snippets={pythonSnippet} />);
    expect(screen.queryByRole('button', { name: /^run$/i })).toBeNull();
  });

  it('should show Run button for javascript/typescript', () => {
    render(<CodePlayground snippets={jsSnippets} />);
    expect(screen.getByRole('button', { name: /^run$/i })).toBeInTheDocument();
  });

  it('should show the sandbox iframe after clicking Run', () => {
    const { container } = render(<CodePlayground snippets={jsSnippets} />);
    fireEvent.click(screen.getByRole('button', { name: /^run$/i }));
    const iframe = container.querySelector('iframe[title="code-sandbox"]');
    expect(iframe).toBeTruthy();
    expect(iframe?.getAttribute('sandbox')).toBe('allow-scripts');
  });

  it('should escape </script> injection in the iframe srcDoc', () => {
    const evilSnippet = [
      {
        language: 'javascript',
        code: 'var x = "</script><script>alert(1)</script>";',
        explanation: 'XSS attempt',
      },
    ];
    const { container } = render(<CodePlayground snippets={evilSnippet} />);
    fireEvent.click(screen.getByRole('button', { name: /^run$/i }));
    const iframe = container.querySelector('iframe[title="code-sandbox"]') as HTMLIFrameElement;
    expect(iframe).toBeTruthy();
    const src = iframe.getAttribute('srcdoc') ?? '';
    // The escaped sequence must be present (we replace </script with <\/script).
    expect(src).toContain('<\\/script');
    // And the raw closing tag (lowercased) must NOT appear inside the user code section.
    // It's fine to have one closing </script> at the bottom of the document body.
    const occurrences = src.match(/<\/script/gi) ?? [];
    expect(occurrences.length).toBe(1);
  });

  it('should navigate between snippets', () => {
    render(<CodePlayground snippets={jsSnippets} />);
    expect(screen.getByText('Logs a greeting')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText('Declare a number')).toBeInTheDocument();
  });

  it('should ignore sandbox messages not originating from its own iframe (regression: no cross-talk)', () => {
    render(<CodePlayground snippets={jsSnippets} />);
    fireEvent.click(screen.getByRole('button', { name: /^run$/i }));
    // Forge a message from the top window — i.e. a sibling playground or any
    // other frame. Without an event.source check this would bleed into the
    // console; the guard must drop it.
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { __viePlayground: true, type: 'log', args: ['leaked output'] },
          source: window,
        }),
      );
    });
    expect(screen.queryByText('leaked output')).toBeNull();
  });

  it('should display console output that originates from its own iframe', () => {
    const { container } = render(<CodePlayground snippets={jsSnippets} />);
    fireEvent.click(screen.getByRole('button', { name: /^run$/i }));
    const iframe = container.querySelector(
      'iframe[title="code-sandbox"]',
    ) as HTMLIFrameElement;
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { __viePlayground: true, type: 'log', args: ['real output'] },
          source: iframe.contentWindow,
        }),
      );
    });
    expect(screen.getByText('real output')).toBeInTheDocument();
  });

  it('should render a snippet with a missing language as plain text without crashing', () => {
    // Assemblers can emit loosely-typed snippets without a `language` — the
    // component must not throw on `language.toLowerCase()`.
    const noLanguage = [
      { code: 'just some text', explanation: 'No language field' },
    ] as unknown as TechSnippet[];
    render(<CodePlayground snippets={noLanguage} />);
    expect(screen.getByText('No language field')).toBeInTheDocument();
    // Falls back to the "text" badge and offers no Run button.
    expect(screen.getByText('text')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^run$/i })).toBeNull();
  });
});
