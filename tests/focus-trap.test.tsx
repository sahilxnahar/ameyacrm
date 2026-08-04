import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useFocusTrap } from '../src/lib/a11y/use-focus-trap';

/*
 * AMH-030 — hand-rolled overlays that did not manage focus.
 *
 * The shared <Dialog> is Radix and has always been correct. Ten panels are
 * bespoke `fixed inset-0` overlays and none of them trapped Tab, handled
 * Escape, or gave focus back on close: a keyboard user tabbed straight out of
 * the panel and started typing into the page behind the backdrop.
 *
 * Rendered rather than grepped, because "the hook is imported" says nothing
 * about whether focus actually moves.
 */
function Panel({ onClose }: { onClose: () => void }) {
  const ref = useFocusTrap<HTMLDivElement>(true, onClose);
  return (
    <div ref={ref} role="dialog" aria-modal="true">
      <button>first</button>
      <input aria-label="middle" />
      <button>last</button>
    </div>
  );
}

describe('a hand-rolled panel keeps the keyboard inside it', () => {
  it('moves focus into the panel when it opens', () => {
    render(<><button>outside</button><Panel onClose={() => {}} /></>);
    expect(screen.getByText('first')).toHaveFocus();
  });

  it('wraps forward from the last control to the first', () => {
    render(<Panel onClose={() => {}} />);
    const last = screen.getByText('last');
    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByText('first')).toHaveFocus();
  });

  it('wraps backward from the first control to the last', () => {
    render(<Panel onClose={() => {}} />);
    screen.getByText('first').focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(screen.getByText('last')).toHaveFocus();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<Panel onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('gives focus back to whatever opened it', () => {
    // Otherwise a screen-reader user is returned to the top of the document
    // with no idea where they had been.
    function Host() {
      const [open, setOpen] = require('react').useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>open me</button>
          {open ? <Panel onClose={() => setOpen(false)} /> : null}
        </>
      );
    }
    render(<Host />);
    const trigger = screen.getByText('open me');
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByText('first')).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(trigger).toHaveFocus();
  });
});
