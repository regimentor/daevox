import { useParams } from "react-router";
import { Chat as ChatFeature } from "../features/chat/ui/chat.js";
import styles from "./chat.module.css";

const Chat = () => {
  const { dialogId } = useParams();

  if (!dialogId) {
    return null;
  }

  return (
    <div className={styles.page}>
      <ChatFeature dialogId={dialogId} />
    </div>
  );
};

export { Chat };
