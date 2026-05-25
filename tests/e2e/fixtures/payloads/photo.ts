import { nextUpdateId } from "./counter";

export function makePhotoUpdate(args: {
  telegramUserId: number;
  firstName?: string;
  sizeBytes: number;
  fileId?: string;
  caption?: string;
}) {
  const fileId = args.fileId ?? `test-photo-${crypto.randomUUID()}`;
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
      caption: args.caption,
      // Three variants: thumbnail → medium → full-size (the one we check)
      photo: [
        { file_id: `${fileId}-xs`, file_unique_id: `xs-${fileId}`, file_size: 1_000,  width: 90,   height: 90 },
        { file_id: `${fileId}-md`, file_unique_id: `md-${fileId}`, file_size: 50_000, width: 320,  height: 320 },
        { file_id: fileId,         file_unique_id: fileId,          file_size: args.sizeBytes, width: 1280, height: 1280 },
      ],
    },
  };
}

export function makeDocumentUpdate(args: {
  telegramUserId: number;
  firstName?: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  fileId?: string;
}) {
  const fileId = args.fileId ?? `test-doc-${crypto.randomUUID()}`;
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
      document: {
        file_id: fileId,
        file_unique_id: fileId,
        file_name: args.fileName,
        mime_type: args.mimeType,
        file_size: args.sizeBytes,
      },
    },
  };
}
