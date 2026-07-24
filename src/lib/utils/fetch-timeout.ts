/**
 * fetch with a deadline.
 *
 * A serverless function has a hard duration limit, and a provider that simply
 * never answers will burn all of it and then fail with nothing useful. Worse
 * now that keys are tried in sequence: four silent providers would be four
 * full timeouts stacked. Every outbound call gets a ceiling.
 */
export async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit = {},
  ms = 25000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(`No answer within ${Math.round(ms / 1000)} seconds.`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
