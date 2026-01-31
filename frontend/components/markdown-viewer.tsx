"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
// Bạn có thể dùng theme bất kỳ; nếu muốn tối giản bundle, bỏ theme đi vẫn chạy
import { duotoneLight } from "react-syntax-highlighter/dist/esm/styles/prism";

type Props = {
    content: string;
    className?: string;
};

export default function MarkdownViewer({ content, className }: Props) {
    return (
        <div className={className}>
            <ReactMarkdown
                // Hỗ trợ bảng, gạch đầu dòng, checklist, strike, v.v.
                remarkPlugins={[remarkGfm]}
                // Sanitize để tránh XSS; đủ cho markdown thuần (không render HTML thô)
                rehypePlugins={[rehypeSanitize]}
                components={{
                    code({ node, inline, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || "");
                        if (inline) {
                            return (
                                <code className="px-1 py-0.5 rounded bg-muted" {...props}>
                                    {children}
                                </code>
                            );
                        }
                        return (
                            <SyntaxHighlighter
                                // Nếu có ngôn ngữ, Prism sẽ highlight; nếu không có vẫn hiển thị
                                language={match?.[1]}
                                style={duotoneLight}
                                customStyle={{
                                    margin: 0,
                                    borderRadius: "0.5rem",
                                    fontSize: "0.9rem",
                                }}
                                PreTag="div"
                                {...props}
                            >
                                {String(children).replace(/\n$/, "")}
                            </SyntaxHighlighter>
                        );
                    },
                    table({ children }) {
                        return (
                            <div className="w-full overflow-auto">
                                <table className="w-full border-collapse">{children}</table>
                            </div>
                        );
                    },
                    th({ children }) {
                        return (
                            <th className="border px-2 py-1 text-left bg-muted">{children}</th>
                        );
                    },
                    td({ children }) {
                        return <td className="border px-2 py-1">{children}</td>;
                    },
                }}
            >
                {content || ""}
            </ReactMarkdown>
        </div>
    );
}
