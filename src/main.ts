/* eslint-disable @typescript-eslint/no-explicit-any */
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { INSTALL_STEPS, POST_INSTALL_STEPS, BOT_GUIDE_STEPS, PM2_STEPS } from './constants';
import { generateHelpResponse } from './services/geminiService';
import { InstallMethod } from './types';

// --- 1. Load .env manually ---
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf-8');
  envConfig.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (key && value) {
        process.env[key] = value;
      }
    }
  });
}

// Ensure API Key exists for Gemini
if (!process.env.API_KEY) {
  // Try to find it in VITE_ prefix if standard is missing (legacy compat)
  process.env.API_KEY = process.env.VITE_API_KEY || process.env.API_KEY;
}

// --- 2. ANSI Colors ---
const c = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  bgBlue: "\x1b[44m",
};

// --- 3. UI Helpers ---
const printHeader = (title: string) => {
  console.clear();
  console.log(`${c.bgBlue}${c.bright}  ${title}  ${c.reset}\n`);
};

const printStep = (step: any, index: number) => {
  console.log(`${c.green}${c.bright}[Step ${index + 1}] ${step.title}${c.reset}`);
  console.log(`${c.reset}${step.description}`);
  console.log(`${c.cyan}> ${step.command}${c.reset}`);
  if (step.explanation) {
    console.log(`${c.yellow}ℹ️  ${step.explanation}${c.reset}`);
  }
  console.log('');
};

const pressAnyKey = () => {
  return new Promise<void>(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`${c.bright}按回车键返回菜单...${c.reset}`, () => {
      rl.close();
      resolve();
    });
  });
};

// --- 4. Modules ---

const showSteps = async (steps: any[], title: string) => {
  printHeader(title);
  steps.forEach((step, idx) => printStep(step, idx));
  await pressAnyKey();
};

const startGeminiChat = async () => {
  printHeader("AI 故障排查专家 (Gemini 3)");
  console.log(`${c.yellow}输入你的问题 (例如: "启动报错 permission denied")，输入 'exit' 退出。${c.reset}\n`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const ask = () => {
    rl.question(`${c.green}你: ${c.reset}`, async (input) => {
      if (input.trim().toLowerCase() === 'exit') {
        rl.close();
        return;
      }

      console.log(`${c.blue}AI 正在思考...${c.reset}`);
      const response = await generateHelpResponse(input);
      console.log(`\n${c.bright}🤖 AI 回复:${c.reset}\n${response}\n`);
      
      ask();
    });
  };

  await new Promise<void>(resolve => {
      ask();
      rl.on('close', resolve);
  });
};

// --- 5. Main Loop ---

const main = async () => {
  while (true) {
    printHeader("Termux Alist 向导 CLI");
    console.log(`1. ${c.bright}手动安装 Alist (推荐)${c.reset}`);
    console.log(`2. ${c.bright}脚本安装 Alist${c.reset}`);
    console.log(`3. ${c.bright}后期配置 (密码/访问)${c.reset}`);
    console.log(`4. ${c.bright}机器人与直播配置向导${c.reset}`);
    console.log(`5. ${c.bright}PM2 进程守护 (自动启动)${c.reset}`);
    console.log(`6. ${c.bright}AI 故障排查${c.reset}`);
    console.log(`0. ${c.bright}退出${c.reset}`);
    console.log('');

    const choice = await new Promise<string>(resolve => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question(`${c.cyan}请选择功能 [0-6]: ${c.reset}`, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });

    switch (choice) {
      case '1':
        await showSteps(INSTALL_STEPS[InstallMethod.BINARY], "Alist 手动安装步骤");
        break;
      case '2':
        await showSteps(INSTALL_STEPS[InstallMethod.SCRIPT], "Alist 脚本安装步骤");
        break;
      case '3':
        await showSteps(POST_INSTALL_STEPS, "Alist 后期配置");
        break;
      case '4':
        await showSteps(BOT_GUIDE_STEPS, "Telegram 机器人配置");
        break;
      case '5':
        await showSteps(PM2_STEPS, "PM2 进程守护配置");
        break;
      case '6':
        await startGeminiChat();
        break;
      case '0':
        console.log("再见！");
        process.exit(0);
        break;
      default:
        console.log(`${c.red}无效的选择，请重试。${c.reset}`);
        await new Promise(r => setTimeout(r, 1000));
    }
  }
};

main().catch(console.error);