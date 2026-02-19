import React, { useState, useRef, useEffect } from 'react';
import { PaperAirplaneIcon, SparklesIcon } from '@heroicons/react/24/solid';
import { generateHelpResponse } from '../services/geminiService';
import { ChatMessage } from '../types';
import ReactMarkdown from 'react-markdown';

export const GeminiAssistant: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Hello! I am your Termux & Alist assistant. Stuck on a step or getting an error? Paste it here!' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const responseText = await generateHelpResponse(input);
    
    setMessages(prev => [...prev, { role: 'model', text: responseText }]);
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-[500px] bg-terminal-card border border-slate-700 rounded-xl overflow-hidden shadow-2xl">
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-4 border-b border-slate-700 flex items-center gap-2">
        <SparklesIcon className="w-5 h-5 text-terminal-accent" />
        <h3 className="font-bold text-slate-200">AI Troubleshooting Assistant</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-terminal-bg/50">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div 
              className={`max-w-[85%] rounded-lg p-3 text-sm leading-relaxed shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-terminal-accent text-slate-900 font-medium' 
                  : 'bg-slate-700 text-slate-200'
              }`}
            >
              <ReactMarkdown 
                components={{
                  code: ({node, ...props}) => <code className="bg-black/30 rounded px-1 py-0.5 text-xs font-mono" {...props} />,
                  pre: ({node, ...props}) => <div className="bg-black/30 rounded p-2 my-2 overflow-x-auto" {...props} />
                }}
              >
                {msg.text}
              </ReactMarkdown>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-700 rounded-lg p-3 flex gap-1 items-center">
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-slate-800 border-t border-slate-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="E.g., 'I got a permission denied error'..."
            className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-terminal-accent focus:ring-1 focus:ring-terminal-accent transition-all"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="bg-terminal-accent hover:bg-terminal-accentHover disabled:opacity-50 text-slate-900 p-2 rounded-lg transition-colors"
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};