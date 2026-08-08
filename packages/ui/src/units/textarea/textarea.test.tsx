import { describe, expect, test } from 'vitest';
import styles from './textarea.module.css';
import { Textarea } from './textarea.js';
import { render } from '../test-utils.js';

describe('Textarea', () => {
  test('associates its label and helper text with the textarea', async () => {
    const container = await render(
      <Textarea
        id="message"
        label="Message"
        helperText="Markdown is supported."
        placeholder="Write a message..."
      />,
    );
    const textarea = container.querySelector('textarea');
    const label = container.querySelector('label');
    const helper = container.querySelector('p');

    expect(label?.htmlFor).toBe('message');
    expect(textarea?.id).toBe('message');
    expect(textarea?.getAttribute('aria-describedby')).toBe('message-helper');
    expect(textarea?.getAttribute('aria-invalid')).toBeNull();
    expect(textarea?.placeholder).toBe('Write a message...');
    expect(helper?.id).toBe('message-helper');
    expect(helper?.textContent).toBe('Markdown is supported.');
  });

  test('uses the error message and marks the control invalid', async () => {
    const container = await render(
      <Textarea
        id="message"
        label="Message"
        error="Please enter a message."
        helperText="This text is replaced by the error."
      />,
    );
    const root = container.firstElementChild;
    const textarea = container.querySelector('textarea');
    const helper = container.querySelector('p');

    expect(root?.classList.contains(styles.error!)).toBe(true);
    expect(textarea?.getAttribute('aria-invalid')).toBe('true');
    expect(helper?.textContent).toBe('Please enter a message.');
  });

  test('supports boolean errors, generated ids, and disabled state', async () => {
    const container = await render(
      <Textarea error label="Message" helperText="Try again." disabled />,
    );
    const textarea = container.querySelector('textarea');
    const label = container.querySelector('label');

    expect(textarea?.disabled).toBe(true);
    expect(textarea?.getAttribute('aria-invalid')).toBe('true');
    expect(textarea?.id).not.toBe('');
    expect(label?.htmlFor).toBe(textarea?.id);
    expect(container.querySelector('p')?.textContent).toBe('Try again.');
  });

  test('does not render a helper element when no helper text is provided', async () => {
    const container = await render(<Textarea aria-label="Message" />);
    const textarea = container.querySelector('textarea');

    expect(container.querySelector('p')).toBeNull();
    expect(textarea?.getAttribute('aria-describedby')).toBeNull();
  });
});
