import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { startInstall } from './install';

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

const runCommand = (cmd: string) => {
    try {
        console.log(`${c.cyan}> ${cmd}${c.reset}`);
        execSync(cmd, { stdio: 'inherit' });
    } catch {
        console.error(`${c.red}命令执行失败${c.reset}`);
    }
    console.log("\n按回车键继续...");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise<void>(resolve => rl.question('', () => { rl.close(); resolve(); }));
};

// --- 4. Main Loop ---

const main = async () => {
  while (true) {
    printHeader("Termux Alist 全能控制台");
    console.log(`1. ${c.bright}🚀 一键安装/修复 (Alist + Bot + PM2)${c.reset}`);
    console.log(`2. ${c.bright}🤖 查看 Bot 日志${c.reset}`);
    console.log(`3. ${c.bright}🔄 重启所有服务${c.reset}`);
    console.log(`4. ${c.bright}🛑 停止所有服务${c.reset}`);
    console.log(`5. ${c.bright}🔑 重置 Alist 密码为 admin${c.reset}`);
    console.log(`6. ${c.bright}⚙️  编辑配置文件 (.env)${c.reset}`);
    console.log(`7. ${c.bright}🐍 编辑 Bot 代码 (bot.py)${c.reset}`);
    console.log(`0. ${c.bright}退出${c.reset}`);
    console.log('');

    const choice = await new Promise<string>(resolve => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question(`${c.cyan}请选择功能 [0-7]: ${c.reset}`, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });

    switch (choice) {
      case '1':
        await startInstall();
        console.log("\n按回车键返回菜单...");
        await new Promise<void>(r => {
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
            rl.question('', () => { rl.close(); r(); });
        });
        break;
      case '2':
        await runCommand('pm2 logs bot --lines 50');
        break;
      case '3':
        await runCommand('pm2 restart all');
        break;
      case '4':
        await runCommand('pm2 stop all');
        break;
      case '5':
        console.log(`${c.yellow}正在尝试将 Alist 密码重置为 'admin'...${c.reset}`);
        await runCommand('alist admin set admin');
        break;
      case '6':
        await runCommand('nano .env');
        break;
      case '7':
        await runCommand('nano bot.py');
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