import { nextUpdateId } from "./counter";

export function makeTextUpdate(args: {
  telegramUserId: number;
  firstName?: string;
  text: string;
}) {
  return {
    update_id: nextUpdateId(),
    message: {
      message_id: Math.floor(Math.random() * 1e9),
      date: Math.floor(Date.now() / 1000),
      chat: { id: args.telegramUserId, type: "private" as const },
      from: {
        id: args.telegramUserId,
        is_bot: false,
        first_name: args.firstName ?? `User${args.telegramUserId}`,
      },
      text: args.text,
    },
  };
}
