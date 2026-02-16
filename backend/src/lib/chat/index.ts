// lib/chat/index.ts
export {
  UUID_RE,
  SYSTEM_USER_ID,
  GUEST_USER_ID,
  GUEST_LOGIN_MESSAGE,
} from "./constants"

export { getCurrentUserId, getOrCreateUserByEmail } from "./user"
export { createSessionIfMissing } from "./session"
export type { CreateSessionIfMissingOpts } from "./session"

export {
  getRecentTurns,
  appendMessage,
  insertAttachments,
} from "./message"
export type { HistTurn, AppendMessageInput } from "./message"

export {
  checkUserDailyLimit,
  checkAgentDailyLimit,
  checkEmbedDailyLimit,
  checkGuestDailyLimit,
} from "./limits"
export type { LimitResult, GuestLimitResult } from "./limits"
