/**
 * The running build number, and nothing else.
 *
 * This is deliberately a file of its own. `changelog.ts` is 125KB of prose —
 * every release note ever written — and the version string used to live inside
 * it. Three things in the app shell need only the version: the sidebar footer,
 * the update banner and the health endpoint. Importing it from the changelog
 * dragged all 125KB into the client bundle of EVERY signed-in screen, because
 * the What's-new panel uses `CHANGELOG` from the same module and so nothing
 * could be tree-shaken away.
 *
 * A number that fits on one line should not cost a fifth of a megabyte on every
 * page load. Import the version from here; import the changelog only where the
 * changelog is actually rendered.
 */
export const APP_VERSION = 'v16.27';
