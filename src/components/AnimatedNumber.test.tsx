import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AnimatedNumber } from './AnimatedNumber';

// Force reduced motion so the value renders immediately (deterministic test).
vi.mock('motion/react', async (orig) => {
  const actual = await orig<typeof import('motion/react')>();
  return { ...actual, useReducedMotion: () => true };
});

afterEach(cleanup);

describe('AnimatedNumber', () => {
  it('renders the final value immediately under reduced motion', () => {
    render(<AnimatedNumber value={140} suffix=" kg" />);
    expect(screen.getByText('140 kg')).toBeInTheDocument();
  });

  it('formats decimals and prefix', () => {
    render(<AnimatedNumber value={2.5} decimals={1} prefix="+" />);
    expect(screen.getByText('+2.5')).toBeInTheDocument();
  });
});
