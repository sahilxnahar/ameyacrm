import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVisiblePoll } from '@/lib/hooks/use-visible-poll';

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  act(() => { document.dispatchEvent(new Event('visibilitychange')); });
}

describe('useVisiblePoll (H1 calm polling)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('fires once immediately on mount when the tab is visible', () => {
    const fn = vi.fn();
    renderHook(() => useVisiblePoll(fn, 1000));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('keeps firing on the interval while visible', () => {
    const fn = vi.fn();
    renderHook(() => useVisiblePoll(fn, 1000));
    fn.mockClear();
    act(() => { vi.advanceTimersByTime(3000); });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('pauses while hidden and resumes with an immediate fire on return', () => {
    const fn = vi.fn();
    renderHook(() => useVisiblePoll(fn, 1000));
    fn.mockClear();

    setHidden(true);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(fn).toHaveBeenCalledTimes(0); // fully paused in the background

    setHidden(false);
    expect(fn).toHaveBeenCalledTimes(1); // immediate refresh on return
    act(() => { vi.advanceTimersByTime(1000); });
    expect(fn).toHaveBeenCalledTimes(2); // and the interval resumes
  });

  it('stops firing after unmount', () => {
    const fn = vi.fn();
    const { unmount } = renderHook(() => useVisiblePoll(fn, 1000));
    fn.mockClear();
    unmount();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(fn).toHaveBeenCalledTimes(0);
  });
});
