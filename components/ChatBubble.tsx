import type { TelegramMessage } from "@/lib/types";
import { formatRelativeTime } from "@/lib/utils";

type Props = { message: TelegramMessage };

export function ChatBubble({ message }: Props) {
  const isOutbound = message.direction === "outbound";
  const isSystem = message.senderType === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-micro text-subtle bg-surface-2 px-3 py-1 rounded-full">
          {message.text}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex items-end gap-2 ${isOutbound ? "flex-row-reverse" : "flex-row"}`}>
      <div className={`max-w-[72%] flex flex-col gap-1 ${isOutbound ? "items-end" : "items-start"}`}>
        {message.senderName && isOutbound && (
          <span className="text-micro text-subtle px-1">{message.senderName}</span>
        )}
        <div
          className={`px-3.5 py-2.5 rounded-2xl text-body-sm leading-relaxed ${
            isOutbound
              ? "bg-primary text-primary-fg rounded-br-sm"
              : "bg-surface border border-border text-text rounded-bl-sm"
          }`}
        >
          {message.text}
        </div>
        <span className="text-micro text-subtle px-1">{formatRelativeTime(message.sentAt)}</span>
      </div>
    </div>
  );
}
