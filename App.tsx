import React, { useState } from 'react';
import { CommandBlock } from './components/CommandBlock';
import { GeminiAssistant } from './components/GeminiAssistant';
import { INSTALL_STEPS, POST_INSTALL_STEPS } from './constants';
import { InstallMethod } from './types';
import { CommandLineIcon, WrenchScrewdriverIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';

const App: React.FC = () => {
  const [activeMethod, setActiveMethod] = useState<InstallMethod>(InstallMethod.BINARY);
  const [currentTab, setCurrentTab] = useState<'guide' | 'troubleshoot'>('guide');

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-text selection:bg-terminal-accent selection:text-terminal-bg">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-terminal-bg/80 border-b border-slate-700 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-terminal-accent to-blue-500 flex items-center justify-center shadow-lg shadow-terminal-accent/20">
              <CommandLineIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">Termux Alist Guide</h1>
              <p className="text-xs text-slate-400">The Modern Install Assistant</p>
            </div>
          </div>
          <nav className="flex gap-2">
            <button
              onClick={() => setCurrentTab('guide')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                currentTab === 'guide'
                  ? 'bg-slate-800 text-terminal-accent ring-1 ring-slate-600'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Installation
            </button>
            <button
              onClick={() => setCurrentTab('troubleshoot')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                currentTab === 'troubleshoot'
                  ? 'bg-slate-800 text-terminal-accent ring-1 ring-slate-600'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <SparklesIcon className="w-4 h-4" />
              AI Assistant
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {currentTab === 'guide' ? (
          <div className="space-y-8 animate-fade-in">
            {/* Intro Section */}
            <section className="bg-terminal-card rounded-xl p-6 border border-slate-700 shadow-xl">
              <h2 className="text-2xl font-bold text-white mb-4">Getting Started</h2>
              <p className="text-slate-300 mb-4 leading-relaxed">
                Alist is a file listing program that supports multiple storages (local, Google Drive, etc.). 
                Running it on Termux allows you to turn your Android phone into a lightweight file server.
              </p>
              
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 flex gap-3 items-start">
                <WrenchScrewdriverIcon className="w-6 h-6 text-blue-400 shrink-0 mt-1" />
                <div>
                  <h4 className="font-semibold text-blue-200 text-sm">Prerequisite</h4>
                  <p className="text-sm text-blue-300/80">
                    Ensure you have Termux installed (preferably from F-Droid, as the Play Store version is outdated).
                  </p>
                </div>
              </div>
            </section>

            {/* Method Selection */}
            <div className="flex gap-4 p-1 bg-slate-800/50 rounded-xl w-fit mx-auto border border-slate-700/50">
               <button
                 onClick={() => setActiveMethod(InstallMethod.BINARY)}
                 className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
                   activeMethod === InstallMethod.BINARY
                     ? 'bg-terminal-accent text-slate-900 shadow-lg'
                     : 'text-slate-400 hover:text-white'
                 }`}
               >
                 Manual Binary (Recommended)
               </button>
               <button
                 onClick={() => setActiveMethod(InstallMethod.SCRIPT)}
                 className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
                   activeMethod === InstallMethod.SCRIPT
                     ? 'bg-terminal-accent text-slate-900 shadow-lg'
                     : 'text-slate-400 hover:text-white'
                 }`}
               >
                 Install Script
               </button>
            </div>

            {/* Steps Container */}
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                 <div className="h-px bg-slate-700 flex-1"></div>
                 <span className="text-sm font-mono text-slate-500 uppercase tracking-widest">Installation Steps</span>
                 <div className="h-px bg-slate-700 flex-1"></div>
              </div>

              {INSTALL_STEPS[activeMethod].map((step, index) => (
                <div key={step.id} className="group relative pl-8 pb-8 border-l-2 border-slate-700 last:border-0 last:pb-0">
                  <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-800 border-2 border-terminal-accent group-hover:bg-terminal-accent transition-colors"></div>
                  
                  <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                    <span className="text-terminal-accent font-mono text-sm opacity-60">0{index + 1}.</span>
                    {step.title}
                  </h3>
                  <p className="text-slate-400 text-sm mt-1 mb-3">{step.description}</p>
                  
                  <CommandBlock command={step.command} />
                  
                  {step.explanation && (
                    <div className="mt-2 text-xs text-slate-500 bg-slate-800/50 p-3 rounded border border-slate-700/50 italic">
                      ℹ️ {step.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Post Install */}
            <div className="space-y-6 pt-8">
              <div className="flex items-center gap-4">
                 <div className="h-px bg-slate-700 flex-1"></div>
                 <span className="text-sm font-mono text-slate-500 uppercase tracking-widest">Configuration</span>
                 <div className="h-px bg-slate-700 flex-1"></div>
              </div>

              {POST_INSTALL_STEPS.map((step, index) => (
                <div key={step.id} className="bg-terminal-card border border-slate-700 p-6 rounded-xl hover:border-terminal-accent/50 transition-colors">
                  <h3 className="text-lg font-bold text-slate-200 mb-2">{step.title}</h3>
                  <p className="text-slate-400 text-sm mb-4">{step.description}</p>
                  <CommandBlock command={step.command} label={step.id === 'access' ? 'URL' : 'BASH'} />
                  {step.explanation && <p className="text-xs text-slate-500 mt-2">{step.explanation}</p>}
                </div>
              ))}
            </div>
            
             <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-6 text-center">
                <h4 className="text-emerald-400 font-bold mb-2">Success?</h4>
                <p className="text-slate-300 text-sm mb-4">
                  If you see the Alist login page, you are good to go! Default username is usually <code className="bg-black/30 px-1 rounded">admin</code>.
                </p>
                <button onClick={() => setCurrentTab('troubleshoot')} className="text-xs text-emerald-400 underline hover:text-emerald-300">
                  Having issues? Ask the AI
                </button>
             </div>

          </div>
        ) : (
          <div className="animate-fade-in max-w-2xl mx-auto">
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-bold text-white mb-2">AI Expert</h2>
              <p className="text-slate-400 text-sm">
                Powered by Gemini 3. Ask about errors like "permission denied", "port in use", or how to configure storage.
              </p>
            </div>
            <GeminiAssistant />
            
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button 
                className="p-4 bg-slate-800 rounded-lg border border-slate-700 hover:border-slate-500 text-left transition-all"
                onClick={() => {
                   // This is a UI hint, in a real app we might pre-fill the chat
                   const input = document.querySelector('input[type="text"]') as HTMLInputElement;
                   if(input) {
                     input.value = "How do I make Alist run in background?";
                     input.focus();
                   }
                }}
              >
                <QuestionMarkCircleIcon className="w-5 h-5 text-terminal-accent mb-2" />
                <span className="text-sm font-semibold text-slate-200">Running in background?</span>
                <p className="text-xs text-slate-500 mt-1">Ask how to use 'nohup' or termux-services</p>
              </button>
               <button 
                className="p-4 bg-slate-800 rounded-lg border border-slate-700 hover:border-slate-500 text-left transition-all"
                onClick={() => {
                   const input = document.querySelector('input[type="text"]') as HTMLInputElement;
                   if(input) {
                     input.value = "How to access Alist from my PC?";
                     input.focus();
                   }
                }}
              >
                <QuestionMarkCircleIcon className="w-5 h-5 text-terminal-accent mb-2" />
                <span className="text-sm font-semibold text-slate-200">Access from PC?</span>
                <p className="text-xs text-slate-500 mt-1">Learn about finding your local IP address</p>
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-800 mt-12 py-8 text-center text-slate-500 text-sm">
        <p>Built with React + Gemini API for the Termux Community.</p>
      </footer>
    </div>
  );
};

// Simple Icon component for reuse if needed, or import from heroicons
const SparklesIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813a3.75 3.75 0 002.576-2.576l.813-2.846A.75.75 0 019 4.5zM6.97 15.03a.75.75 0 011.06 1.06l-2.25 2.25a.75.75 0 01-1.06 0l-.75-.75a.75.75 0 011.06-1.06l.22.22 1.72-1.72zm11.06-9.25a.75.75 0 00-1.06-1.06l-1.72 1.72-.22-.22a.75.75 0 00-1.06 1.06l.75.75a.75.75 0 001.06 0l2.25-2.25z" clipRule="evenodd" />
  </svg>
);

export default App;