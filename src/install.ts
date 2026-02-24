import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// --- Helper Functions ---
const run = (cmd: string, ignoreError = false) => {
    console.log(`\x1b[36m> ${cmd}\x1b[0m`);
    try {
        execSync(cmd, { stdio: 'inherit' });
    } catch (e: unknown) {
        if (!ignoreError) {
            console.error(`\x1b[31mCommand failed: ${cmd}\x1b[0m`);
            // Don't exit process in module mode, just throw
            throw new Error(`Command failed: ${cmd}`, { cause: e });
        } else {
            console.warn(`\x1b[33mCommand failed (ignored): ${cmd}\x1b[0m`);
        }
    }
}

export const startInstall = async (skipAlistConfig = false) => {
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

    console.log("\x1b[1;32m=== 开始全自动安装流程 ===\x1b[0m");

    try {
        // --- 2. Alist Installation ---
        console.log("\n\x1b[1;34m[1/5] 安装 Alist...\x1b[0m");

        try {
            execSync('command -v alist', { stdio: 'ignore' });
            console.log("Alist 已安装，跳过安装步骤。");
        } catch {
            // Remove local binary if exists to avoid confusion
            if (fs.existsSync('alist')) {
                console.log("清理旧的本地 Alist 文件...");
                fs.unlinkSync('alist');
            }
            // Install via pkg
            run('pkg install alist -y');
        }

        // Set Alist Password
        console.log("\n\x1b[1;34m[2/5] 配置 Alist...\x1b[0m");
        // Try to stop existing instance just in case
        run('pkill alist', true);

        if (!skipAlistConfig) {
            try {
                const password = 'admin'; // Default password for auto-setup
                // Use global command
                run(`alist admin set ${password}`);
                console.log(`\x1b[32mAlist 管理员密码已设置为: ${password}\x1b[0m`);
            } catch {
                console.error("设置密码失败，可能是第一次运行需要先启动一次生成配置？");
            }
        } else {
            console.log("跳过 Alist 密码重置。");
        }

        // --- 3. Bot Environment ---
        console.log("\n\x1b[1;34m[3/5] 安装 Bot 环境...\x1b[0m");
        
        const checkPkg = (pkg: string) => {
            try {
                execSync(`dpkg -s ${pkg}`, { stdio: 'ignore' });
                return true;
            } catch {
                return false;
            }
        };

        const pkgsToInstall = ['python', 'termux-api', 'ffmpeg', 'nano', 'vim'].filter(p => !checkPkg(p));
        if (pkgsToInstall.length > 0) {
            run(`pkg install ${pkgsToInstall.join(' ')} -y`);
        } else {
            console.log("Python, Termux-API, FFmpeg, Nano, Vim 已安装。");
        }

        const checkPip = (pkg: string) => {
            try {
                execSync(`python -c "import ${pkg}"`, { stdio: 'ignore' });
                return true;
            } catch {
                return false;
            }
        };

        const pipPkgs = [];
        if (!checkPip('telebot')) pipPkgs.push('pyTelegramBotAPI');
        if (!checkPip('requests')) pipPkgs.push('requests');
        if (!checkPip('psutil')) pipPkgs.push('psutil');
        if (!checkPip('speedtest')) pipPkgs.push('speedtest-cli');

        console.log("正在检查并更新 Python 依赖...");
        run('pip install --upgrade pyTelegramBotAPI requests psutil speedtest-cli', true);

        console.log("\x1b[1;33m⚠️ 重要提示: 请确保你已安装 'Termux:API' 安卓应用，并授予其'位置信息'权限，否则 WiFi 功能将无法工作！\x1b[0m");
        console.log("\x1b[1;33m⚠️ 正在请求存储权限，请在手机上点击'允许'...\x1b[0m");
        run('termux-setup-storage', true);

        // --- 4. Generate bot.py ---
        console.log("\n\x1b[1;34m[4/5] 检查 bot.py...\x1b[0m");
        if (!fs.existsSync('bot.py')) {
            console.log("bot.py 不存在，请确保文件完整。");
        } else {
            console.log("bot.py 已就绪。");
        }

        // --- 5. PM2 Configuration ---
        console.log("\n\x1b[1;34m[5/5] 配置 PM2 自动启动...\x1b[0m");
        try {
            execSync('command -v pm2', { stdio: 'ignore' });
            console.log("PM2 已安装。");
        } catch {
            run('npm install pm2 -g');
        }

        // Stop existing PM2 processes to avoid duplicates
        try { execSync('pm2 delete alist', { stdio: 'ignore' }); } catch { /* ignore */ }
        try { execSync('pm2 delete bot', { stdio: 'ignore' }); } catch { /* ignore */ }

        // Start processes
        // Get alist path
        let alistPath = 'alist';
        try {
            alistPath = execSync('which alist').toString().trim();
        } catch {
            console.warn("Could not find alist in PATH, assuming 'alist'");
        }
        run(`pm2 start ${alistPath} --name alist -- server`);
        
        // Wait for Alist to start and fetch token
        console.log("\n\x1b[1;34m正在等待 Alist 启动以获取 Token...\x1b[0m");
        let tokenFetched = false;
        for (let i = 0; i < 5; i++) {
            try {
                execSync('sleep 2');
                const response = await fetch('http://127.0.0.1:5244/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: 'admin', password: 'admin' })
                });
                const data = await response.json() as { code: number, data: { token: string } };
                if (data.code === 200) {
                    const token = data.data.token;
                    console.log("\x1b[1;32m✅ 成功自动获取 Alist Token!\x1b[0m");
                    
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
                    
                    tokenFetched = true;
                    break;
                }
            } catch {
                // Ignore and retry
            }
        }
        
        if (!tokenFetched) {
            console.log("\x1b[1;33m⚠️ 自动获取 Token 失败，请稍后在主菜单选择【8】手动获取。\x1b[0m");
        }

        const botPath = path.resolve('bot.py');
        run(`pm2 start ${botPath} --name bot --interpreter python`);

        // Save and resurrect
        run('pm2 save');

        // Add to .bashrc if not present
        const bashrcPath = path.join(process.env.HOME || '', '.bashrc');
        const resurrectCmd = 'pm2 resurrect';
        let bashrcContent = '';
        if (fs.existsSync(bashrcPath)) {
            bashrcContent = fs.readFileSync(bashrcPath, 'utf-8');
        }

        if (!bashrcContent.includes(resurrectCmd)) {
            fs.appendFileSync(bashrcPath, `\n${resurrectCmd}\n`);
            console.log("已将 'pm2 resurrect' 添加到 .bashrc");
        } else {
            console.log(".bashrc 已包含 pm2 resurrect");
        }

        console.log("\n\x1b[1;32m=== ✅ 安装全部完成！ ===\x1b[0m");
        console.log("Alist 访问地址: http://127.0.0.1:5244");
        console.log("Alist 默认密码: admin");
        console.log("Bot 状态: 正在后台运行");
        console.log("PM2 状态: 已配置开机自启");
        console.log("提示: 运行 'npm start' 可进入管理菜单。");

    } catch (error) {
        console.error("\n\x1b[1;31m❌ 安装过程中出错:\x1b[0m", error);
    }
};

// If run directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
    startInstall();
}