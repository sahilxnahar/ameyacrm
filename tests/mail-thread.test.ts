import { describe, it, expect } from 'vitest';
import { threadKeyFor, extractAddress, stripQuoted } from '@/lib/mail/thread';

describe('mail threading (v15.19 shared inbox / email inbox)', () => {
  it('threads replies and forwards onto the same conversation', () => {
    const a = threadKeyFor('Site visit', 'buyer@example.com');
    const b = threadKeyFor('Re: Site visit', 'buyer@example.com');
    const c = threadKeyFor('Re: Fwd: Site visit', 'buyer@example.com');
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('separates different subjects', () => {
    expect(threadKeyFor('Booking', 'x@e.com')).not.toBe(threadKeyFor('Payment', 'x@e.com'));
  });

  it('extracts a bare address from a display-name header', () => {
    expect(extractAddress('Anita Rao <anita@acme.com>')).toBe('anita@acme.com');
    expect(extractAddress('plain@acme.com')).toBe('plain@acme.com');
  });

  it('strips quoted history from a reply body', () => {
    const body = 'Yes, 4pm works.\n\nOn Mon, 1 Jul, Anita wrote:\n> the original message\n> more quoted';
    const clean = stripQuoted(body);
    expect(clean).toContain('4pm works');
    expect(clean).not.toContain('more quoted');
  });
});
