import { nextUpdateId } from "./counter";

export function makeContactUpdate(args: {
  telegramUserId: number;
  firstName?: string;
  phone: string;
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
      contact: {
        phone_number: args.phone,
        first_name: args.firstName ?? `User${args.telegramUserId}`,
        user_id: args.telegramUserId,
      },
    },
  };
}
