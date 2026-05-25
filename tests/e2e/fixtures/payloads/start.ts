import { nextUpdateId } from "./counter";

export function makeStartUpdate(args: {
  telegramUserId: number;
  firstName?: string;
  username?: string;
  payload?: string;
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
        username: args.username,
      },
      text: args.payload ? `/start ${args.payload}` : "/start",
      entities: [{ type: "bot_command" as const, offset: 0, length: 6 }],
    },
  };
}
