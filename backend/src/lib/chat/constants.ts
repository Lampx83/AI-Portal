// lib/chat/constants.ts

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** System user when user_id is null (schema NOT NULL). */
export const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000"

/** Guest account: unauthenticated data is stored under this user. N messages/day/device/assistant limit. */
export const GUEST_USER_ID = "11111111-1111-1111-1111-111111111111"

export const GUEST_LOGIN_MESSAGE =
  "Hãy đăng nhập để tiếp tục sử dụng"
