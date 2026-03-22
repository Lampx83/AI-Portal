export type TimeToolInput = {
  timezone?: string;
  locale?: string;
};

export type TimeToolOutput = {
  ok: boolean;
  now: string;
  timezone: string;
  hint: string;
};

export function helloTimeTool(input: TimeToolInput = {}): TimeToolOutput {
  const timezone = input.timezone || "Asia/Ho_Chi_Minh";
  const locale = input.locale || "vi-VN";

  const now = new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
    timeStyle: "long",
    timeZone: timezone,
  }).format(new Date());

  return {
    ok: true,
    now,
    timezone,
    hint: "Use this output for quick diagnostics in assistant responses.",
  };
}

export const toolManifest = {
  name: "hello-time-tool",
  description: "Return current time string for selected timezone.",
  inputSchema: {
    type: "object",
    properties: {
      timezone: { type: "string", description: "IANA timezone." },
      locale: { type: "string", description: "Intl locale." },
    },
    additionalProperties: false,
  },
};
