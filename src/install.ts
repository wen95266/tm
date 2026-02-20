import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

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

const ENV_BOT_TOKEN = process.env.BOT_TOKEN || '你的_BOT_TOKEN';
const ENV_ADMIN_ID = process.env.ADMIN_ID || '0';

// --- 2. Helper Functions ---
const run = (cmd: string, ignoreError = false) => {
    console.log(`\x1b[36m> ${cmd}\x1b[0m`);
    try {
        execSync(cmd, { stdio: 'inherit' });
    } catch (e) {
        if (!ignoreError) {
            console.error(`\x1b[31mCommand failed: ${cmd}\x1b[0m`);
            process.exit(1);
        } else {
            console.warn(`\x1b[33mCommand failed (ignored): ${cmd}\x1b[0m`);
        }
    }
}

console.log("\x1b[1;32m=== 开始全自动安装流程 ===\x1b[0m");

// --- 3. Alist Installation ---
console.log("\n\x1b[1;34m[1/5] 安装 Alist...\x1b[0m");

// Remove local binary if exists to avoid confusion
if (fs.existsSync('alist')) {
    console.log("清理旧的本地 Alist 文件...");
    fs.unlinkSync('alist');
}

// Install via pkg
run('pkg install alist -y');

// Set Alist Password
console.log("\n\x1b[1;34m[2/5] 配置 Alist...\x1b[0m");
// Try to stop existing instance just in case
run('pkill alist', true);

try {
    const password = 'admin'; // Default password for auto-setup
    // Use global command
    run(`alist admin set ${password}`);
    console.log(`\x1b[32mAlist 管理员密码已设置为: ${password}\x1b[0m`);
} catch (e) {
    console.error("设置密码失败，可能是第一次运行需要先启动一次生成配置？");
}

// --- 4. Bot Environment ---
console.log("\n\x1b[1;34m[3/5] 安装 Bot 环境...\x1b[0m");
run('pkg install python termux-api ffmpeg -y');
run('pip install pyTelegramBotAPI');

// Generate bot.py
console.log("\n\x1b[1;34m[4/5] 生成 bot.py...\x1b[0m");
const botContent = `import telebot
import subprocess
import time
import threading
import json
import signal
import os

# --- 🚀 基础配置 ---
BOT_TOKEN = '${ENV_BOT_TOKEN}'
ADMIN_ID = ${ENV_ADMIN_ID} 

# --- ⚠️ 需手动修改的配置 ---
# 1. Telegram 直播推流地址 (rtmp://...)
TG_RTMP_URL = 'rtmp://你的服务器地址/密钥'

# 2. WiFi 自动重连配置 (SSID: 密码)
WIFI_CONFIG = {
    'MyHomeWifi': 'password123',
    'MyOfficeWifi': 'password456'
}

bot = telebot.TeleBot(BOT_TOKEN)
stream_process = None

def run_command(cmd):
    try:
        # 使用 timeout 防止命令卡死，stderr=subprocess.STDOUT 合并错误输出
        return subprocess.check_output(cmd, shell=True, timeout=10, stderr=subprocess.STDOUT).decode('utf-8').strip()
    except subprocess.CalledProcessError as e:
        return ""
    except Exception as e:
        return str(e)

def is_authorized(message):
    if ADMIN_ID == 0: return True
    return message.from_user.id == ADMIN_ID

# --- 📺 推流逻辑 ---
@bot.message_handler(commands=['stream'])
def start_stream(message):
    if not is_authorized(message): return
    global stream_process
    
    try:
        parts = message.text.split(maxsplit=1)
        if len(parts) < 2:
            bot.reply_to(message, "❌ 用法: /stream <直链URL>")
            return

        video_url = parts[1]
        
        # 停止旧进程
        if stream_process:
            stop_stream_process(stream_process)

        bot.reply_to(message, "🚀 正在启动 FFmpeg 推流...")

        # FFmpeg 参数优化: 
        # -re (实时读取), ultrafast (低延迟编码), zerolatency (零延迟)
        cmd = [
            'ffmpeg', '-re', '-i', video_url,
            '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency',
            '-b:v', '2500k', '-maxrate', '3000k', '-bufsize', '6000k',
            '-r', '30', '-g', '60',
            '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
            '-f', 'flv', TG_RTMP_URL
        ]

        # preexec_fn=os.setsid 创建新的进程组，方便后续 killpg 一起杀掉
        stream_process = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, preexec_fn=os.setsid)
        bot.reply_to(message, "✅ 推流已在后台运行！")
        
    except Exception as e:
        bot.reply_to(message, f"❌ 启动失败: {e}")

def stop_stream_process(proc):
    if proc and proc.poll() is None:
        try:
            # 尝试优雅终止进程组 (SIGTERM)
            os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
            proc.wait(timeout=5)
        except:
            try:
                # 强制杀死进程组 (SIGKILL)
                os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
            except:
                pass

@bot.message_handler(commands=['stop_stream'])
def stop_stream_cmd(message):
    if not is_authorized(message): return
    global stream_process
    if stream_process and stream_process.poll() is None:
        stop_stream_process(stream_process)
        stream_process = None
        bot.reply_to(message, "⏹ 直播推流已停止")
    else:
        bot.reply_to(message, "⚠️ 当前无正在进行的推流")

# --- 📡 WiFi 监控 ---
def check_wifi_loop():
    print("📡 WiFi 监控服务已启动")
    while True:
        try:
            info_str = run_command('termux-wifi-connectioninfo')
            try:
                info = json.loads(info_str)
            except:
                info = {}
            
            # 检查 supplicant_state
            if info.get('supplicant_state') != 'COMPLETED':
                print("⚠️ WiFi 断线，正在扫描备用网络...")
                
                # 遍历配置尝试连接
                for ssid, pwd in WIFI_CONFIG.items():
                    print(f"🔄 尝试连接: {ssid}")
                    run_command(f'termux-wifi-connect -s "{ssid}" -p "{pwd}"')
                    
                    # 轮询检查连接状态 (最多等待 15秒)
                    for _ in range(3):
                        time.sleep(5)
                        check = run_command('termux-wifi-connectioninfo')
                        # 简单字符串检查，防止 JSON 解析失败导致逻辑中断
                        if '"supplicant_state": "COMPLETED"' in check and f'"{ssid}"' in check:
                            print(f"✅ 成功连接到: {ssid}")
                            # 跳出重试循环
                            break
                    else:
                        continue # 继续尝试下一个 SSID
                    
                    # 如果成功连接，跳出 SSID 循环，回到主监控循环
                    break

            time.sleep(20)
        except Exception as e:
            print(f"WiFi 监控错误: {e}")
            time.sleep(20)

# --- 🤖 机器人响应 ---
@bot.message_handler(commands=['start'])
def send_welcome(message):
    if not is_authorized(message): return
    bot.reply_to(message, 
        "🤖 **Termux 助手**\\n"
        "🎬 /stream <url> - 推流\\n"
        "⏹ /stop_stream - 停止\\n"
        "📡 /status - 状态\\n"
        "🔄 /switch <ssid> - 切WiFi"
    )

@bot.message_handler(commands=['status'])
def status(message):
    if not is_authorized(message): return
    try:
        info_str = run_command('termux-wifi-connectioninfo')
        wifi = json.loads(info_str).get('ssid', '未知')
    except:
        wifi = "获取失败 (请检查 Termux:API 权限)"
        
    st = "🟢 推流中" if stream_process and stream_process.poll() is None else "🔴 未推流"
    bot.reply_to(message, f"📡 WiFi: {wifi}\\n🎬 直播: {st}")

@bot.message_handler(commands=['switch'])
def switch_wifi(message):
    if not is_authorized(message): return
    try:
        ssid = message.text.split(maxsplit=1)[1]
        pwd = WIFI_CONFIG.get(ssid)
        if pwd:
            bot.reply_to(message, f"🔄 正在切换到 {ssid}...")
            run_command(f'termux-wifi-connect -s "{ssid}" -p "{pwd}"')
            bot.reply_to(message, "指令已发送，请等待连接...")
        else:
            bot.reply_to(message, "❌ 未知 SSID (请先在脚本 WIFI_CONFIG 中添加)")
    except:
        bot.reply_to(message, "用法: /switch <ssid>")

# 启动后台线程
t = threading.Thread(target=check_wifi_loop)
t.daemon = True
t.start()

print("Bot is running...")
# 自动重连机制
while True:
    try:
        bot.polling(non_stop=True, interval=2, timeout=20)
    except Exception as e:
        print(f"Bot 连接断开: {e}")
        time.sleep(5)
`;

fs.writeFileSync('bot.py', botContent);
console.log("bot.py 已生成。");

// --- 5. PM2 Configuration ---
console.log("\n\x1b[1;34m[5/5] 配置 PM2 自动启动...\x1b[0m");
run('npm install pm2 -g');

// Stop existing PM2 processes to avoid duplicates
run('pm2 delete alist', true);
run('pm2 delete bot', true);

// Start processes
// Get alist path
let alistPath = 'alist';
try {
    alistPath = execSync('which alist').toString().trim();
} catch (e) {
    console.warn("Could not find alist in PATH, assuming 'alist'");
}
run(`pm2 start ${alistPath} --name alist -- server`);
run('pm2 start python --name bot -- bot.py');

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
