import React, { useState } from 'react';
import { ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/outline';

interface CommandBlockProps {
  command: string;
  label?: string;
}

export const CommandBlock: React.FC<CommandBlockProps> = ({ command, label = 'BASH' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group rounded-lg overflow-hidden border border-slate-700 bg-terminal-cmd shadow-sm">
      <div className="flex justify-between items-center px-4 py-2 bg-slate-800/50 border-b border-slate-700/50">
        <span className="text-xs font-mono text-slate-500">{label}</span>
        <button
          onClick={handleCopy}
          className="text-slate-400 hover:text-white transition-colors"
          title="复制命令"
        >
          {copied ? (
            <CheckIcon className="w-4 h-4 text-green-500" />
          ) : (
            <ClipboardDocumentIcon className="w-4 h-4" />
          )}
        </button>
      </div>
      <div className="p-4 overflow-x-auto">
        <code className="text-sm font-mono text-green-400 whitespace-pre">{command}</code>
      </div>
    </div>
  );
};
