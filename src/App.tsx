import React, { useState } from 'react';
import { CommandBlock } from './components/CommandBlock';
import { GeminiAssistant } from './components/GeminiAssistant';
import { INSTALL_STEPS, POST_INSTALL_STEPS, BOT_GUIDE_STEPS } from './constants';
import { InstallMethod } from './types';
import { CommandLineIcon, WrenchScrewdriverIcon, QuestionMarkCircleIcon, PaperAirplaneIcon, WifiIcon, SparklesIcon } from '@heroicons/react/24/outline';

const App: React.FC = () => {
  const [activeMethod, setActiveMethod] = useState<InstallMethod>(InstallMethod.BINARY);
  const [currentTab, setCurrentTab] = useState<'guide' | 'bot' | 'troubleshoot'>('guide');

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
              <h1 className="text-xl font-bold tracking-tight text-white">Termux Alist 向导</h1>
              <p className="text-xs text-slate-400">现代化安装助手</p>
            </div>
          </div>
          <nav className="hidden md:flex gap-2">
            <button
              onClick={() => setCurrentTab('guide')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                currentTab === 'guide'
                  ? 'bg-slate-800 text-terminal-accent ring-1 ring-slate-600'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              安装教程
            </button>
            <button
              onClick={() => setCurrentTab('bot')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                currentTab === 'bot'
                  ? 'bg-slate-800 text-terminal-accent ring-1 ring-slate-600'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <PaperAirplaneIcon className="w-4 h-4" />
              机器人助手
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
              AI 专家
            </button>
          </nav>
        </div>
        {/* Mobile Nav */}
        <div className="md:hidden flex justify-between py-2 border-t border-slate-800 bg-slate-900/50 px-2 gap-2">
             <button onClick={() => setCurrentTab('guide')} className={`flex-1 flex flex-col items-center p-2 rounded-lg ${currentTab === 'guide' ? 'bg-slate-800 text-terminal-accent' : 'text-slate-500'}`}>
               <CommandLineIcon className="w-6 h-6"/>
               <span className="text-[10px] mt-1">安装</span>
             </button>
             <button onClick={() => setCurrentTab('bot')} className={`flex-1 flex flex-col items-center p-2 rounded-lg ${currentTab === 'bot' ? 'bg-slate-800 text-terminal-accent' : 'text-slate-500'}`}>
               <PaperAirplaneIcon className="w-6 h-6"/>
               <span className="text-[10px] mt-1">机器人</span>
             </button>
             <button onClick={() => setCurrentTab('troubleshoot')} className={`flex-1 flex flex-col items-center p-2 rounded-lg ${currentTab === 'troubleshoot' ? 'bg-slate-800 text-terminal-accent' : 'text-slate-500'}`}>
               <SparklesIcon className="w-6 h-6"/>
               <span className="text-[10px] mt-1">AI 诊断</span>
             </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {currentTab === 'guide' && (
          <div className="space-y-8 animate-fade-in">
            {/* Intro Section */}
            <section className="bg-terminal-card rounded-xl p-6 border border-slate-700 shadow-xl">
              <h2 className="text-2xl font-bold text-white mb-4">开始使用</h2>
              <p className="text-slate-300 mb-4 leading-relaxed">
                Alist 是一个支持多种存储（本地、网盘等）的文件列表程序。
                在 Termux 上运行它可以让你的 Android 手机变身为轻量级文件服务器。
              </p>
              
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 flex gap-3 items-start">
                <WrenchScrewdriverIcon className="w-6 h-6 text-blue-400 shrink-0 mt-1" />
                <div>
                  <h4 className="font-semibold text-blue-200 text-sm">先决条件</h4>
                  <p className="text-sm text-blue-300/80">
                    确保你安装了 Termux（最好是从 F-Droid 安装，Play 商店版本已过时）。
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
                 手动安装 (推荐)
               </button>
               <button
                 onClick={() => setActiveMethod(InstallMethod.SCRIPT)}
                 className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
                   activeMethod === InstallMethod.SCRIPT
                     ? 'bg-terminal-accent text-slate-900 shadow-lg'
                     : 'text-slate-400 hover:text-white'
                 }`}
               >
                 脚本安装
               </button>
            </div>

            {/* Steps Container */}
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                 <div className="h-px bg-slate-700 flex-1"></div>
                 <span className="text-sm font-mono text-slate-500 uppercase tracking-widest">安装步骤</span>
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
                 <span className="text-sm font-mono text-slate-500 uppercase tracking-widest">配置</span>
                 <div className="h-px bg-slate-700 flex-1"></div>
              </div>

              {POST_INSTALL_STEPS.map((step) => (
                <div key={step.id} className="bg-terminal-card border border-slate-700 p-6 rounded-xl hover:border-terminal-accent/50 transition-colors">
                  <h3 className="text-lg font-bold text-slate-200 mb-2">{step.title}</h3>
                  <p className="text-slate-400 text-sm mb-4">{step.description}</p>
                  <CommandBlock command={step.command} label={step.id === 'access' ? 'URL' : 'BASH'} />
                  {step.explanation && <p className="text-xs text-slate-500 mt-2">{step.explanation}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {currentTab === 'bot' && (
           <div className="space-y-8 animate-fade-in">
             <section className="bg-terminal-card rounded-xl p-6 border border-slate-700 shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                 <div className="p-2 bg-blue-500/20 rounded-lg">
                    <PaperAirplaneIcon className="w-6 h-6 text-blue-400" />
                 </div>
                 <h2 className="text-2xl font-bold text-white">Telegram 机器人管家</h2>
              </div>
              <p className="text-slate-300 mb-4 leading-relaxed">
                通过搭建一个简单的 Telegram Bot，你可以远程管理 Alist 进程，甚至控制 Termux 的 WiFi 连接（包括断线自动重连）。
              </p>
              
              <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 flex gap-3 items-start">
                <WifiIcon className="w-6 h-6 text-yellow-400 shrink-0 mt-1" />
                <div>
                  <h4 className="font-semibold text-yellow-200 text-sm">重要提示：WiFi 控制</h4>
                  <p className="text-sm text-yellow-300/80">
                    WiFi 功能依赖于 <strong>Termux:API</strong> 应用。你需要从 F-Droid 下载该应用，并在系统设置中授予 Termux:API "位置信息" 权限（因为扫描 WiFi 需要位置权限）。
                  </p>
                </div>
              </div>
            </section>

             <div className="space-y-6">
              {BOT_GUIDE_STEPS.map((step, index) => (
                <div key={step.id} className="group relative pl-8 pb-8 border-l-2 border-slate-700 last:border-0 last:pb-0">
                  <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-800 border-2 border-blue-400 group-hover:bg-blue-400 transition-colors"></div>
                  
                  <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                    <span className="text-blue-400 font-mono text-sm opacity-60">步骤 {index + 1}</span>
                    {step.title}
                  </h3>
                  <p className="text-slate-400 text-sm mt-1 mb-3">{step.description}</p>
                  
                  <CommandBlock command={step.command} label={step.id === 'bot_script' ? 'BASH' : 'BASH'} />
                  
                  {step.explanation && (
                    <div className="mt-2 text-xs text-slate-500 bg-slate-800/50 p-3 rounded border border-slate-700/50 italic">
                      ℹ️ {step.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>
           </div>
        )}

        {currentTab === 'troubleshoot' && (
          <div className="animate-fade-in max-w-2xl mx-auto">
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-bold text-white mb-2">AI 专家助手</h2>
              <p className="text-slate-400 text-sm">
                由 Gemini 3 驱动。询问关于 "权限不足"、"端口占用"、"WiFi 无法扫描" 等问题。
              </p>
            </div>
            <GeminiAssistant />
            
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button 
                className="p-4 bg-slate-800 rounded-lg border border-slate-700 hover:border-slate-500 text-left transition-all"
                onClick={() => {
                   const input = document.querySelector('input[type="text"]') as HTMLInputElement;
                   if(input) {
                     input.value = "如何让 Alist 在后台运行？";
                     // Trigger change event if needed by React state, but simple set works for this demo
                     const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
                     nativeInputValueSetter?.call(input, "如何让 Alist 在后台运行？");
                     input.dispatchEvent(new Event('input', { bubbles: true }));
                     input.focus();
                   }
                }}
              >
                <QuestionMarkCircleIcon className="w-5 h-5 text-terminal-accent mb-2" />
                <span className="text-sm font-semibold text-slate-200">后台运行?</span>
                <p className="text-xs text-slate-500 mt-1">了解 nohup 或 termux-services</p>
              </button>
               <button 
                className="p-4 bg-slate-800 rounded-lg border border-slate-700 hover:border-slate-500 text-left transition-all"
                onClick={() => {
                   const input = document.querySelector('input[type="text"]') as HTMLInputElement;
                   if(input) {
                     input.value = "如何从电脑访问手机的 Alist？";
                     const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
                     nativeInputValueSetter?.call(input, "如何从电脑访问手机的 Alist？");
                     input.dispatchEvent(new Event('input', { bubbles: true }));
                     input.focus();
                   }
                }}
              >
                <QuestionMarkCircleIcon className="w-5 h-5 text-terminal-accent mb-2" />
                <span className="text-sm font-semibold text-slate-200">电脑访问?</span>
                <p className="text-xs text-slate-500 mt-1">查询局域网 IP 地址</p>
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

export default App;