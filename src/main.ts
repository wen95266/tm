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
  // Check for --install flag
  if (process.argv.includes('--install')) {
    console.log("Detected --install flag, running auto-install...");
    await startInstall();
    console.log("Install completed.");
    process.exit(0);
  }

  while (true) {
    printHeader("Termux Alist 全能控制台");
    console.log(`1. ${c.bright}🚀 一键安装/修复 (Alist + Bot + PM2)${c.reset}`);
    console.log(`2. ${c.bright}🤖 查看 Bot 日志${c.reset}`);
    console.log(`3. ${c.bright}🔄 重启所有服务${c.reset}`);
    console.log(`4. ${c.bright}🛑 停止所有服务${c.reset}`);
    console.log(`5. ${c.bright}🔑 重置 Alist 密码为 admin${c.reset}`);
    console.log(`6. ${c.bright}⚙️  编辑配置文件 (.env)${c.reset}`);
    console.log(`7. ${c.bright}🐍 编辑 Bot 代码 (bot.py)${c.reset}`);
    console.log(`8. ${c.bright}🔑 自动获取/配置 Alist Token${c.reset}`);
    console.log(`0. ${c.bright}退出${c.reset}`);
    console.log('');

    const choice = await new Promise<string>(resolve => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question(`${c.cyan}请选择功能 [0-8]: ${c.reset}`, (answer) => {
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
      case '8':
        await configureAlistToken();
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

const configureAlistToken = async () => {
    console.log(`${c.cyan}正在尝试自动获取 Alist Token...${c.reset}`);
    
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const password = await new Promise<string>(resolve => {
        rl.question(`${c.yellow}请输入 Alist 管理员密码 (默认 admin): ${c.reset}`, (answer) => {
            rl.close();
            resolve(answer.trim() || 'admin');
        });
    });

    try {
        const response = await fetch('http://127.0.0.1:5244/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password })
        });
        
        const data = await response.json() as { code: number; data: { token: string }; message: string };
        
        if (data.code === 200) {
            const token = data.data.token;
            console.log(`${c.green}✅ 成功获取 Token!${c.reset}`);
            
            // Update .env
            const envPath = path.resolve(process.cwd(), '.env');
            let envContent = '';
            if (fs.existsSync(envPath)) {
                envContent = fs.readFileSync(envPath, 'utf-8');
            }
            
            const lines = envContent.split('\n');
            let found = false;
            const newLines = lines.map(line => {
                if (line.startsWith('ALIST_TOKEN=')) {
                    found = true;
                    return `ALIST_TOKEN=${token}`;
                }
                return line;
            });
            
            if (!found) {
                newLines.push(`ALIST_TOKEN=${token}`);
            }
            
            fs.writeFileSync(envPath, newLines.join('\n'));
            process.env.ALIST_TOKEN = token; // Update process.env so startInstall picks it up
            console.log(`${c.green}✅ Token 已保存到 .env 文件${c.reset}`);
            
            // Ask to apply
            const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
            const apply = await new Promise<string>(resolve => {
                rl2.question(`${c.cyan}是否立即应用更改 (重启服务)? [Y/n]: ${c.reset}`, (answer) => {
                    rl2.close();
                    resolve(answer.trim().toLowerCase());
                });
            });
            
            if (apply === '' || apply === 'y') {
                await startInstall(true);
                console.log("\n按回车键返回菜单...");
                await new Promise<void>(r => {
                    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
                    rl.question('', () => { rl.close(); r(); });
                });
            }
            
        } else {
            console.error(`${c.red}❌ 登录失败: ${data.message}${c.reset}`);
            console.log("\n按回车键返回菜单...");
            await new Promise<void>(r => {
                const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
                rl.question('', () => { rl.close(); r(); });
            });
        }
    } catch (e) {
        console.error(`${c.red}❌ 连接 Alist 失败，请确保 Alist 正在运行。${c.reset}`, e);
        console.log("\n按回车键返回菜单...");
        await new Promise<void>(r => {
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
            rl.question('', () => { rl.close(); r(); });
        });
    }
};

main().catch(console.error);