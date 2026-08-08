import { act, type ReactNode } from 'react';
import { afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<{ container: HTMLDivElement; root: Root }> = [];

const render = async (element: ReactNode) => {
  const container = document.createElement('div');
  document.body.append(container);

  const root = createRoot(container);
  roots.push({ container, root });

  await act(async () => {
    root.render(element);
  });

  return container;
};

afterEach(async () => {
  await act(async () => {
    for (const { root } of roots) {
      root.unmount();
    }
  });

  for (const { container } of roots) {
    container.remove();
  }

  roots.length = 0;
});

export { render };
