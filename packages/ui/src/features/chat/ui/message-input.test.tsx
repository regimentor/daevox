import { act } from 'react';
import { describe, expect, test, vi } from 'vitest';
import styles from './message-input.module.css';
import { MessageInput } from './message-input.js';
import { render } from '../../../units/test-utils.js';

const changeContent = async (textarea: HTMLTextAreaElement, value: string) => {
  await act(async () => {
    const setValue = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value',
    )?.set;
    setValue?.call(textarea, value);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

describe('MessageInput', () => {
  test('renders an empty, disabled form', async () => {
    const container = await render(<MessageInput />);
    const form = container.querySelector('form');
    const textarea = container.querySelector<HTMLTextAreaElement>('textarea');
    const submit = container.querySelector<HTMLButtonElement>('button');

    expect(form?.classList.contains(styles.root!)).toBe(true);
    expect(textarea?.getAttribute('aria-label')).toBe('Message');
    expect(textarea?.placeholder).toBe('Write a message...');
    expect(textarea?.value).toBe('');
    expect(submit?.classList.contains(styles.submit!)).toBe(true);
    expect(submit?.textContent).toBe('Send');
    expect(submit?.disabled).toBe(true);
  });

  test('trims submitted content and clears the input', async () => {
    const onSubmit = vi.fn();
    const container = await render(<MessageInput onSubmit={onSubmit} />);
    const textarea = container.querySelector<HTMLTextAreaElement>('textarea')!;
    const submit = container.querySelector<HTMLButtonElement>('button')!;

    await changeContent(textarea, '  Hello there  ');
    expect(submit.disabled).toBe(false);

    await act(async () => {
      submit.click();
    });

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledWith('Hello there');
    expect(textarea.value).toBe('');
    expect(submit.disabled).toBe(true);
  });

  test('keeps whitespace-only content without submitting it', async () => {
    const onSubmit = vi.fn();
    const container = await render(<MessageInput onSubmit={onSubmit} />);
    const textarea = container.querySelector<HTMLTextAreaElement>('textarea')!;
    const form = container.querySelector('form')!;

    await changeContent(textarea, '   ');
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(textarea.value).toBe('   ');
  });

  test('does not submit or clear content when no handler is supplied', async () => {
    const container = await render(<MessageInput />);
    const textarea = container.querySelector<HTMLTextAreaElement>('textarea')!;
    const form = container.querySelector('form')!;

    await changeContent(textarea, 'A message');
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(textarea.value).toBe('A message');
  });

  test('submits with Ctrl+Enter and keeps Enter for new lines', async () => {
    const onSubmit = vi.fn();
    const container = await render(<MessageInput onSubmit={onSubmit} />);
    const textarea = container.querySelector<HTMLTextAreaElement>('textarea')!;

    await changeContent(textarea, 'A message');
    await act(async () => {
      textarea.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key: 'Enter',
        }),
      );
    });
    expect(onSubmit).not.toHaveBeenCalled();

    await act(async () => {
      textarea.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          key: 'Enter',
        }),
      );
    });

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledWith('A message');
    expect(textarea.value).toBe('');
  });

  test('does not send while an agent response is in progress but keeps the draft editable', async () => {
    const onSubmit = vi.fn();
    const container = await render(
      <MessageInput onSubmit={onSubmit} isSending />,
    );
    const textarea = container.querySelector<HTMLTextAreaElement>('textarea')!;
    const submit = container.querySelector<HTMLButtonElement>('button')!;

    await changeContent(textarea, 'Keep this draft');
    expect(submit.disabled).toBe(true);

    await act(async () => {
      container.querySelector('form')?.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(textarea.value).toBe('Keep this draft');
  });

  test('keeps the draft when submit fails', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Agent unavailable'));
    const container = await render(<MessageInput onSubmit={onSubmit} />);
    const textarea = container.querySelector<HTMLTextAreaElement>('textarea')!;

    await changeContent(textarea, 'Retry this message');
    await act(async () => {
      container.querySelector<HTMLButtonElement>('button')?.click();
    });

    expect(onSubmit).toHaveBeenCalledWith('Retry this message');
    expect(textarea.value).toBe('Retry this message');
  });
});
