import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// The agent's replies are plain Gemini text, which routinely comes back with
// markdown (bold, links, lists) — render it instead of dumping raw asterisks
// and bracket syntax into the chat bubble.
export default function MarkdownMessage({ text }: { text: string }) {
  return (
    <div className="prose-chat">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" className="text-anvil-accent underline hover:no-underline" />
          ),
          code: ({ ...props }) => (
            <code {...props} className="bg-anvil-bg border border-anvil-border rounded px-1 py-0.5 text-[11px] font-mono" />
          ),
          pre: ({ ...props }) => (
            <pre {...props} className="bg-anvil-bg border border-anvil-border rounded-md p-2 overflow-x-auto text-[11px] font-mono" />
          ),
          ul: ({ ...props }) => <ul {...props} className="list-disc pl-4 space-y-0.5" />,
          ol: ({ ...props }) => <ol {...props} className="list-decimal pl-4 space-y-0.5" />,
          p: ({ ...props }) => <p {...props} className="mb-1.5 last:mb-0" />,
          h1: ({ ...props }) => <h1 {...props} className="text-sm font-semibold mb-1" />,
          h2: ({ ...props }) => <h2 {...props} className="text-sm font-semibold mb-1" />,
          h3: ({ ...props }) => <h3 {...props} className="text-xs font-semibold mb-1" />,
          table: ({ ...props }) => (
            <div className="overflow-x-auto">
              <table {...props} className="border-collapse text-[11px]" />
            </div>
          ),
          th: ({ ...props }) => <th {...props} className="border border-anvil-border px-1.5 py-1 text-left bg-anvil-bg" />,
          td: ({ ...props }) => <td {...props} className="border border-anvil-border px-1.5 py-1" />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
