import { act } from 'react';
import { fork } from 'effector';
import { Provider } from 'effector-react';
import { describe, expect, test } from 'vitest';
import chatStyles from './chat.module.css';
import messageStyles from '../../../units/message/message.module.css';
import { Chat } from './chat.js';
import { $messages, type ChatMessage } from '../chat.store.js';
import { render } from '../../../units/test-utils.js';

const renderChat = async (messages: ChatMessage[] = [], className?: string) => {
  const scope = fork({ values: [[$messages, messages]] });
  const chat = className === undefined ? <Chat /> : <Chat className={className} />;

  const container = await render(
    <Provider value={scope}>
      {chat}
    </Provider>,
  );

  return { container, scope };
};

describe('Chat', () => {
  test('renders the empty state and input', async () => {
    const { container } = await renderChat([], 'custom-chat');
    const section = container.querySelector('section');
    const history = container.querySelector('[role="log"]');

    expect(section?.classList.contains(chatStyles.root!)).toBe(true);
    expect(section?.classList.contains('custom-chat')).toBe(true);
    expect(section?.getAttribute('aria-label')).toBe('Chat');
    expect(history?.classList.contains(chatStyles.history!)).toBe(true);
    expect(history?.textContent).toBe('No messages yet.');
    expect(container.querySelector('textarea')).not.toBeNull();
  });

  test('renders user and agent messages with their respective alignment and author', async () => {
    const messages: ChatMessage[] = [
      {
        actor: 'user',
        type: 'completion',
        content: 'Hello',
        createdAt: new Date('2026-08-08T10:30:00.000Z'),
      },
      {
        actor: 'agent',
        type: 'completion',
        content: 'Hi there',
        createdAt: new Date('2026-08-08T10:30:04.000Z'),
      },
    ];
    const { container } = await renderChat(messages);
    const articles = [...container.querySelectorAll('article')];

    expect(articles).toHaveLength(2);
    expect(articles[0]?.classList.contains(messageStyles.right!)).toBe(true);
    expect(articles[0]?.querySelector(`.${messageStyles.author!}`)?.textContent).toBe('You');
    expect(articles[0]?.querySelector(`.${messageStyles.body!}`)?.textContent).toBe('Hello');
    expect(articles[0]?.querySelector(`.${messageStyles.timestamp!}`)?.textContent).toMatch(/\d{1,2}:\d{2}/);
    expect(articles[1]?.classList.contains(messageStyles.left!)).toBe(true);
    expect(articles[1]?.querySelector(`.${messageStyles.author!}`)?.textContent).toBe('Daevox');
    expect(articles[1]?.querySelector(`.${messageStyles.body!}`)?.textContent).toBe('Hi there');
  });

  test('adds a submitted user message to the scoped history', async () => {
    const { container } = await renderChat();
    const textarea = container.querySelector<HTMLTextAreaElement>('textarea')!;
    const form = container.querySelector('form')!;

    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value',
      )?.set;
      setValue?.call(textarea, '  New message  ');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    const message = container.querySelector('article');
    expect(message?.classList.contains(messageStyles.right!)).toBe(true);
    expect(message?.querySelector(`.${messageStyles.author!}`)?.textContent).toBe('You');
    expect(message?.querySelector(`.${messageStyles.body!}`)?.textContent).toBe('New message');
    expect(container.querySelector('textarea')?.value).toBe('');
  });
});
