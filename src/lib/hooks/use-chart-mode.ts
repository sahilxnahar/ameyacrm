'use client';
import { useTheme } from 'next-themes';
import type { ChartMode } from '@/config/chart-theme';

/**
 * Which set of chart colours this screen should draw with.
 *
 * Dark mode is a *selected* palette, not an automatic inversion — the eight
 * hues are re-stepped to the dark lightness band so they clear 3:1 against
 * charcoal, which a flipped light palette does not. So a chart has to know
 * which mode it is in; it cannot infer it from a CSS variable.
 *
 * Returns 'light' until the theme has resolved on the client. That is the
 * correct default rather than a guess: the server has no idea what the reader's
 * system preference is, and rendering dark-mode colours into a light-mode first
 * paint is a visible flash of the wrong palette.
 */
export function useChartMode(): ChartMode {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === 'dark' ? 'dark' : 'light';
}
