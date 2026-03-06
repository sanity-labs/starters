// Renders a single text part of a chat message as rich markdown.
// Uses @sanity/agent-directives to parse and transform ::document{} directives
// into React components (Document, Product, etc.)

import { remarkAgentDirectives } from "@sanity/agent-directives/react";
import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";

import { cn } from "@/lib/utils";

import { Document } from "./Document";

interface TextPartProps {
  text: string;
  isUser: boolean;
}

/**
 * Wrapper for consecutive directives - renders children in a flex column
 * with proper spacing between product cards
 */
function DirectivesStack({ children }: { children?: React.ReactNode }) {
  return <div className="flex flex-col gap-2">{children}</div>;
}

type ExtendedComponents = Components & {
  Document: typeof Document;
  DirectivesStack: typeof DirectivesStack;
};

export function TextPart({ text, isUser }: TextPartProps) {
  if (!text.trim()) return null;

  const components: ExtendedComponents = {
    Document,
    DirectivesStack,

    a(props) {
      const { href = "", children } = props;
      const isInternal = href.startsWith("/");
      const className = cn(
        "underline",
        isUser ? "text-white/90 hover:text-white" : "text-blue-600 hover:text-blue-700",
      );

      if (isInternal) {
        return (
          <Link href={href} className={className}>
            {children}
          </Link>
        );
      }

      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
          {children}
        </a>
      );
    },
    p: ({ children }: { children?: React.ReactNode }) => (
      <p className="whitespace-pre-wrap">{children}</p>
    ),
    ul: ({ children }: { children?: React.ReactNode }) => (
      <ul className="list-disc pl-4">{children}</ul>
    ),
    ol: (props) => <ol className="list-decimal pl-4">{props.children}</ol>,
  };

  return (
    <ReactMarkdown remarkPlugins={[remarkAgentDirectives]} components={components}>
      {text}
    </ReactMarkdown>
  );
}
