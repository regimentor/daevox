import {
  completionErrorCodes,
  type CompletionErrorEvent,
} from "@daevox/contracts";
import styles from "./notification.module.css";

type CompletionErrorNotificationProps = {
  event: CompletionErrorEvent | null;
  onDismiss: () => void;
};

const getCompletionErrorMessage = (
  code: CompletionErrorEvent["code"],
): string => {
  switch (code) {
    case completionErrorCodes.networkTimeout:
      return "Не удалось дождаться ответа модели. Проверьте подключение и попробуйте ещё раз.";
    case completionErrorCodes.responseTooLong:
      return "Ответ модели превысил допустимый лимит. Попробуйте сократить запрос или начать новый диалог.";
    case completionErrorCodes.unknown:
      return "Не удалось получить ответ от модели. Попробуйте ещё раз.";
  }
};

const CompletionErrorNotification = ({
  event,
  onDismiss,
}: CompletionErrorNotificationProps) => {
  if (!event) {
    return null;
  }

  return (
    <aside className={styles.root} role="alert" aria-live="assertive">
      <div className={styles.header}>
        <strong>Ошибка ответа</strong>
        <button
          className={styles.close}
          type="button"
          aria-label="Закрыть уведомление"
          onClick={onDismiss}
        >
          ×
        </button>
      </div>
      <p className={styles.message}>{getCompletionErrorMessage(event.code)}</p>
    </aside>
  );
};

export { CompletionErrorNotification, getCompletionErrorMessage };
export type { CompletionErrorNotificationProps };
