import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { WarmupBadge } from './WarmupBadge';

afterEach(cleanup);

describe('WarmupBadge', () => {
  it('renders a labelled lime "W" mark', () => {
    render(<WarmupBadge />);
    const badge = screen.getByRole('img', { name: /warm-up set/i });
    expect(badge).toHaveTextContent('W');
    expect(badge.className).toMatch(/bg-highlight/);
    expect(badge.className).toMatch(/text-highlight-foreground/);
  });

  it('supports a smaller size variant', () => {
    render(<WarmupBadge size="sm" />);
    expect(screen.getByRole('img', { name: /warm-up set/i }).className).toMatch(/size-4/);
  });
});
