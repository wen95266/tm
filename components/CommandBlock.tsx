import React, { useState } from 'react';
import { ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/outline';

interface CommandBlockProps {
  command: string;
  label?: string;
}

export const CommandBlock: React.FC<CommandBlockProps> = ({ command, label }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 rounded-lg overflow-hidden border border-slate-700 bg-terminal-cmd shadow-lg">
      <div className="flex justify-between items-center px-4 py-2 bg-slate-800 border-b border-slate-700">
        <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
          {label || 'BASH'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-terminal-accent transition-colors"
          title="Copy command"
        >
          {copied ? (
            <>
              <CheckIcon className="w-4 h-4 text-terminal-accent" />
              <span className="text-terminal-accent">已复制!</span>
            </>
          ) : (
            <>
              <ClipboardDocumentIcon className="w-4 h-4" />
              <span>复制</span>
            </>
          )}
        </button>
      </div>
      <div className="p-4 overflow-x-auto">
        <code className="text-sm font-mono text-terminal-accent whitespace-nowrap">
          {command}
        </code>
      </div>
    </div>
  );
};