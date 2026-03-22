export type ToolInput = {
  name?: string;
  language?: "vi" | "en";
};

export type ToolResult = {
  ok: boolean;
  message: string;
  metadata: {
    tool: string;
    version: string;
  };
};

export function helloWorldTool(input: ToolInput = {}): ToolResult {
  const finalName = input.name?.trim() || "developer";
  const language = input.language ?? "vi";
  const greeting =
    language === "en" ? `Hello, ${finalName}!` : `Xin chao, ${finalName}!`;

  return {
    ok: true,
    message: `${greeting} This response comes from helloWorldTool.`,
    metadata: {
      tool: "helloWorldTool",
      version: "1.0.0",
    },
  };
}

export const toolManifest = {
  name: "hello-world-tool",
  description: "Return a friendly greeting for testing Tool integration.",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Name to greet." },
      language: {
        type: "string",
        enum: ["vi", "en"],
        description: "Response language.",
      },
    },
    additionalProperties: false,
  },
};
