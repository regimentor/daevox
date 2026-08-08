import { Chat as ChatFeature } from "../features/chat/ui/chat.js";
import styles from "./chat.module.css";

const Chat = () => {
  return (
    <div className={styles.page}>
      <ChatFeature />
    </div>
  );
};

export { Chat };
