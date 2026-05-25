import { nextUpdateId } from "./counter";

export function makeCallbackUpdate(args: {
  telegramUserId: number;
  firstName?: string;
  data: string;
  messageId?: number;
}) {
  const msgId = args.messageId ?? Math.floor(Math.random() * 1e9);
  return {
    update_id: nextUpdateId(),
    callback_query: {
      id: `cq-${nextUpdateId()}`,
      from: {
        id: args.telegramUserId,
        is_bot: false,
        first_name: args.firstName ?? `User${args.telegramUserId}`,
      },
      message: {
        message_id: msgId,
        date: Math.floor(Date.now() / 1000),
        chat: { id: args.telegramUserId, type: "private" as const },
        text: "menu",
      },
      chat_instance: String(args.telegramUserId),
      data: args.data,
    },
  };
}
