import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { Field } from '../src/components/ui/field';

/*
 * AMH-013, proved rather than asserted.
 *
 * tests/form-accessibility.test.ts checks the SOURCE of `Field`. That is worth
 * having, but source-shape assertions are exactly what let this bug live for
 * sixteen versions: the old code contained `<label htmlFor=…>` and looked
 * correct in every review.
 *
 * These tests render the component and ask the accessibility tree the question a
 * screen reader asks — "what is this input called?" — via `getByLabelText`,
 * which resolves labels the same way a browser does. If the association breaks,
 * the query throws, whatever the source says.
 */
describe('a rendered Field is actually labelled', () => {
  it('the label names the control', () => {
    render(<Field label="Project name"><input name="name" /></Field>);
    // Throws unless the accessible name resolves. This failed before the fix.
    expect(screen.getByLabelText('Project name')).toHaveAttribute('name', 'name');
  });

  it('works for a select and a textarea too, not just text inputs', () => {
    render(
      <>
        <Field label="City"><select name="city"><option>Bangalore</option></select></Field>
        <Field label="Notes"><textarea name="notes" /></Field>
      </>,
    );
    expect(screen.getByLabelText('City').tagName).toBe('SELECT');
    expect(screen.getByLabelText('Notes').tagName).toBe('TEXTAREA');
  });

  it('a required field announces the word, not just the asterisk', () => {
    // Colour and a "*" glyph carry nothing to a screen reader or to a
    // colour-blind reader. The accessible name has to contain the word.
    render(<Field label="PAN" required><input name="pan" /></Field>);
    expect(screen.getByLabelText(/PAN.*\(required\)/)).toBeInTheDocument();
  });

  it('an error is announced when it appears, not just drawn', () => {
    render(<Field label="IFSC" error="That is not a valid IFSC."><input name="ifsc" /></Field>);
    // role=alert is what makes it announced rather than only findable.
    expect(screen.getByRole('alert')).toHaveTextContent('That is not a valid IFSC.');
  });

  it('the hint gives way to the error rather than stacking two messages', () => {
    const { rerender } = render(
      <Field label="IFSC" hint="Eleven characters."><input name="ifsc" /></Field>,
    );
    expect(screen.getByText('Eleven characters.')).toBeInTheDocument();
    rerender(<Field label="IFSC" hint="Eleven characters." error="Invalid."><input name="ifsc" /></Field>);
    expect(screen.queryByText('Eleven characters.')).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid.');
  });

  it('the escape hatch still associates, given a matching id', () => {
    render(<Field label="Code" htmlFor="code-x"><input id="code-x" name="code" /></Field>);
    expect(screen.getByLabelText('Code')).toHaveAttribute('name', 'code');
  });

  it('emits no label element at all when there is no label text', () => {
    const { container } = render(<Field><input name="bare" /></Field>);
    // An empty <label> announces as a labelled group containing nothing.
    expect(container.querySelector('label')).toBeNull();
  });

  it('does not nest one label inside another', () => {
    // Nested labels are invalid, and browsers disagree about which control wins.
    const { container } = render(<Field label="Outer"><input name="x" /></Field>);
    expect(container.querySelectorAll('label label')).toHaveLength(0);
  });
});
