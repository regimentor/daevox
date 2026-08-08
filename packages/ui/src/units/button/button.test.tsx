import { describe, expect, test, vi } from 'vitest';
import styles from './button.module.css';
import { Button } from './button.js';
import { render } from '../test-utils.js';

describe('Button', () => {
  test('uses the default variant, size, and button type', async () => {
    const container = await render(<Button>Save</Button>);
    const button = container.querySelector('button');

    expect(button).not.toBeNull();
    expect(button?.textContent).toBe('Save');
    expect(button?.type).toBe('button');
    expect(button?.classList.contains(styles.button!)).toBe(true);
    expect(button?.classList.contains(styles.primary!)).toBe(true);
    expect(button?.classList.contains(styles.sm!)).toBe(true);
  });

  test('applies variants, sizes, custom classes, and native props', async () => {
    const container = await render(
      <Button
        className="custom-button"
        disabled
        size="lg"
        type="submit"
        variant="danger"
        aria-label="Delete"
      >
        Delete
      </Button>,
    );
    const button = container.querySelector('button');

    expect(button?.classList.contains(styles.danger!)).toBe(true);
    expect(button?.classList.contains(styles.lg!)).toBe(true);
    expect(button?.classList.contains('custom-button')).toBe(true);
    expect(button?.type).toBe('submit');
    expect(button?.disabled).toBe(true);
    expect(button?.getAttribute('aria-label')).toBe('Delete');
  });

  test('calls onClick when enabled and ignores clicks when disabled', async () => {
    const onClick = vi.fn();
    const enabled = await render(<Button onClick={onClick}>Run</Button>);
    const enabledButton = enabled.querySelector('button');

    enabledButton?.click();
    expect(onClick).toHaveBeenCalledTimes(1);

    const disabled = await render(
      <Button disabled onClick={onClick}>
        Run
      </Button>,
    );
    disabled.querySelector('button')?.click();

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
