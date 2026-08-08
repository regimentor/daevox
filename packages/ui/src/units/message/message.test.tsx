import { describe, expect, test, vi } from 'vitest';
import styles from './message.module.css';
import { Message } from './message.js';
import { render } from '../test-utils.js';

describe('Message', () => {
  test('renders an incoming message with the copy action before its timestamp', async () => {
    const container = await render(
      <Message author="Daevox" timestamp="12:34">
        The deployment completed successfully.
      </Message>,
    );
    const article = container.querySelector('article');
    const content = article?.querySelector(`.${styles.content}`);
    const footer = article?.querySelector(`.${styles.footer}`);

    expect(article?.classList.contains(styles.left!)).toBe(true);
    expect(article?.querySelector(`.${styles.accent!}`)).not.toBeNull();
    expect(content?.querySelector(`.${styles.author!}`)?.textContent).toBe('Daevox');
    expect(content?.querySelector(`.${styles.body!}`)?.textContent).toBe(
      'The deployment completed successfully.',
    );
    expect(content?.querySelector(`.${styles.timestamp!}`)?.textContent).toBe('12:34');
    expect(footer?.children.item(0)?.querySelector('button')).not.toBeNull();
    expect(footer?.children.item(1)?.classList.contains(styles.timestamp!)).toBe(true);
  });

  test('renders outgoing messages on the right and places copy after the timestamp', async () => {
    const container = await render(
      <Message alignment="right" author="You" timestamp="12:35">
        Great, thank you!
      </Message>,
    );
    const article = container.querySelector('article');
    const footer = article?.querySelector(`.${styles.footer}`);

    expect(article?.classList.contains(styles.right!)).toBe(true);
    expect(article?.querySelectorAll(`.${styles.accent!}`).length).toBe(1);
    expect(footer?.children.item(0)?.classList.contains(styles.timestamp!)).toBe(true);
    expect(footer?.children.item(1)?.querySelector('button')).not.toBeNull();
  });

  test('calls the supplied copy handler', async () => {
    const onCopy = vi.fn();
    const container = await render(
      <Message author="Daevox" timestamp="12:34" onCopy={onCopy}>
        Copy me
      </Message>,
    );

    container.querySelector<HTMLButtonElement>('button')?.click();

    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  test('copies string content with the clipboard fallback', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    const container = await render(
      <Message author="Daevox" timestamp="12:34">
        Copy me
      </Message>,
    );

    container.querySelector<HTMLButtonElement>('button')?.click();

    expect(writeText).toHaveBeenCalledWith('Copy me');
    vi.unstubAllGlobals();
  });

  test('does not use the clipboard fallback for non-string content', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    const container = await render(
      <Message author="Daevox" timestamp="12:34">
        <strong>Copy me</strong>
      </Message>,
    );

    container.querySelector<HTMLButtonElement>('button')?.click();

    expect(writeText).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
