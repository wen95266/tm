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
from telebot import types
import subprocess
import time
import threading
import json
import signal
import os
import re

# --- 🚀 基础配置 ---
BOT_TOKEN = '${ENV_BOT_TOKEN}'
ADMIN_ID = ${ENV_ADMIN_ID} 

# --- ⚠️ 需手动修改的配置 ---
# 1. Telegram 直播推流地址 (rtmp://...)
TG_RTMP_URL = 'rtmp://你的服务器地址/密钥'

# 2. WiFi 自动重连配置 (SSID: 密码)
# 只有在此列表中的 WiFi 才能自动重连或通过菜单一键连接
WIFI_CONFIG = {
    'MyHomeWifi': 'password123',
    'MyOfficeWifi': 'password456'
}

# 3. 网络检测目标 (用于判断是否断网)
PING_TARGET = '223.5.5.5' # 阿里DNS，国内通用

bot = telebot.TeleBot(BOT_TOKEN)
stream_process = None
auto_switch_enabled = True # 默认开启自动切换

def run_command(cmd):
    try:
        # 使用 timeout 防止命令卡死，stderr=subprocess.STDOUT 合并错误输出
        return subprocess.check_output(cmd, shell=True, timeout=15, stderr=subprocess.STDOUT).decode('utf-8').strip()
    except subprocess.CalledProcessError as e:
        return ""
    except Exception as e:
        return str(e)

def is_authorized(message):
    if ADMIN_ID == 0: return True
    if hasattr(message, 'from_user'):
        return message.from_user.id == ADMIN_ID
    if hasattr(message, 'message'): # CallbackQuery
        return message.message.chat.id == ADMIN_ID
    return False

# --- 🛠 辅助函数 ---

def check_internet():
    """检测网络连通性"""
    try:
        subprocess.check_call(['ping', '-c', '1', '-W', '2', PING_TARGET], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except:
        return False

def get_current_wifi():
    """获取当前连接的 WiFi SSID"""
    try:
        info_str = run_command('termux-wifi-connectioninfo')
        info = json.loads(info_str)
        return info.get('ssid', '未连接')
    except:
        return "获取失败"

def get_scan_results():
    """扫描附近的 WiFi"""
    try:
        res = run_command('termux-wifi-scaninfo')
        if not res: return []
        scan_list = json.loads(res)
        # 去重并按信号强度排序
        seen = set()
        unique_list = []
        for wifi in scan_list:
            ssid = wifi.get('ssid')
            if ssid and ssid not in seen:
                seen.add(ssid)
                unique_list.append(wifi)
        # 信号强度 rssi 一般是负数，越大越好
        unique_list.sort(key=lambda x: x.get('rssi', -100), reverse=True)
        return unique_list
    except Exception as e:
        print(f"扫描失败: {e}")
        return []

def connect_wifi(ssid, password):
    """连接指定 WiFi"""
    print(f"🔄 正在连接: {ssid}...")
    run_command(f'termux-wifi-connect -s "{ssid}" -p "{password}"')
    # 等待连接结果
    for _ in range(10):
        time.sleep(2)
        curr = get_current_wifi()
        if curr == ssid:
            return True
    return False

# --- 📺 推流逻辑 ---
def start_ffmpeg_stream(video_url, chat_id):
    global stream_process
    if stream_process:
        stop_stream_process(stream_process)

    bot.send_message(chat_id, "🚀 正在启动 FFmpeg 推流...")

    cmd = [
        'ffmpeg', '-re', '-i', video_url,
        '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency',
        '-b:v', '2500k', '-maxrate', '3000k', '-bufsize', '6000k',
        '-r', '30', '-g', '60',
        '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
        '-f', 'flv', TG_RTMP_URL
    ]

    try:
        stream_process = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, preexec_fn=os.setsid)
        bot.send_message(chat_id, "✅ 推流已在后台运行！")
    except Exception as e:
        bot.send_message(chat_id, f"❌ 启动失败: {e}")

def stop_stream_process(proc):
    if proc and proc.poll() is None:
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
            proc.wait(timeout=5)
        except:
            try:
                os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
            except:
                pass

# --- ⌨️ 键盘菜单 ---

def get_main_keyboard():
    markup = types.InlineKeyboardMarkup(row_width=2)
    btn_wifi = types.InlineKeyboardButton("📡 WiFi 管理", callback_data="menu_wifi")
    btn_status = types.InlineKeyboardButton("📊 系统状态", callback_data="status")
    btn_stream = types.InlineKeyboardButton("🎬 开始推流", callback_data="stream_input")
    btn_stop = types.InlineKeyboardButton("⏹ 停止推流", callback_data="stop_stream")
    markup.add(btn_wifi, btn_status, btn_stream, btn_stop)
    return markup

def get_wifi_keyboard():
    markup = types.InlineKeyboardMarkup()
    
    # 1. 扫描到的 WiFi
    scan_list = get_scan_results()
    current_ssid = get_current_wifi()
    
    markup.add(types.InlineKeyboardButton(f"当前: {current_ssid}", callback_data="refresh_wifi"))
    
    count = 0
    for wifi in scan_list:
        if count >= 8: break # 最多显示8个
        ssid = wifi['ssid']
        rssi = wifi.get('rssi', 0)
        
        # 标记已知密码的 WiFi
        icon = "🔒"
        if ssid in WIFI_CONFIG:
            icon = "✅" if ssid == current_ssid else "🔗"
        
        btn_text = f"{icon} {ssid} ({rssi}dBm)"
        markup.add(types.InlineKeyboardButton(btn_text, callback_data=f"conn_{ssid}"))
        count += 1

    # 功能按钮
    toggle_text = "⏸ 暂停自动切换" if auto_switch_enabled else "▶️ 开启自动切换"
    markup.add(types.InlineKeyboardButton(toggle_text, callback_data="toggle_autoswitch"))
    markup.add(types.InlineKeyboardButton("🔄 刷新列表", callback_data="refresh_wifi"))
    markup.add(types.InlineKeyboardButton("🔙 返回主菜单", callback_data="main_menu"))
    return markup

# --- 🤖 消息处理 ---

@bot.message_handler(commands=['start', 'menu'])
def send_menu(message):
    if not is_authorized(message): return
    bot.reply_to(message, "🤖 **Termux 控制台**", reply_markup=get_main_keyboard())

@bot.callback_query_handler(func=lambda call: True)
def callback_handler(call):
    if not is_authorized(call): return
    global auto_switch_enabled, stream_process
    
    if call.data == "main_menu":
        bot.edit_message_text("🤖 **Termux 控制台**", call.message.chat.id, call.message.message_id, reply_markup=get_main_keyboard())
        
    elif call.data == "menu_wifi":
        bot.edit_message_text("📡 **正在扫描 WiFi...**", call.message.chat.id, call.message.message_id)
        bot.edit_message_text("📡 **WiFi 列表**\n点击名称连接 (需在配置中预存密码)", call.message.chat.id, call.message.message_id, reply_markup=get_wifi_keyboard())
        
    elif call.data == "refresh_wifi":
        bot.answer_callback_query(call.id, "正在刷新...")
        bot.edit_message_reply_markup(call.message.chat.id, call.message.message_id, reply_markup=get_wifi_keyboard())
        
    elif call.data == "status":
        wifi = get_current_wifi()
        internet = "✅ 在线" if check_internet() else "❌ 离线"
        st = "🟢 推流中" if stream_process and stream_process.poll() is None else "🔴 未推流"
        text = f"📊 **系统状态**\n\n📡 WiFi: {wifi}\nww🌐 网络: {internet}\n🎬 直播: {st}"
        bot.edit_message_text(text, call.message.chat.id, call.message.message_id, reply_markup=get_main_keyboard())
        
    elif call.data == "toggle_autoswitch":
        auto_switch_enabled = not auto_switch_enabled
        status = "已开启" if auto_switch_enabled else "已暂停"
        bot.answer_callback_query(call.id, f"自动切换 {status}")
        bot.edit_message_reply_markup(call.message.chat.id, call.message.message_id, reply_markup=get_wifi_keyboard())
        
    elif call.data.startswith("conn_"):
        ssid = call.data[5:]
        pwd = WIFI_CONFIG.get(ssid)
        if pwd:
            bot.answer_callback_query(call.id, f"正在连接 {ssid}...")
            if connect_wifi(ssid, pwd):
                bot.send_message(call.message.chat.id, f"✅ 成功连接到 {ssid}")
                bot.edit_message_reply_markup(call.message.chat.id, call.message.message_id, reply_markup=get_wifi_keyboard())
            else:
                bot.send_message(call.message.chat.id, f"❌ 连接 {ssid} 失败")
        else:
            bot.answer_callback_query(call.id, "❌ 未知密码，请先在 bot.py 配置", show_alert=True)

    elif call.data == "stop_stream":
        if stream_process:
            stop_stream_process(stream_process)
            stream_process = None
            bot.answer_callback_query(call.id, "直播已停止")
            bot.edit_message_text("⏹ 直播推流已停止", call.message.chat.id, call.message.message_id, reply_markup=get_main_keyboard())
        else:
            bot.answer_callback_query(call.id, "当前没有直播")

    elif call.data == "stream_input":
        msg = bot.send_message(call.message.chat.id, "请回复直播源链接 (RTMP/HTTP/M3U8):")
        bot.register_next_step_handler(msg, handle_stream_url)

def handle_stream_url(message):
    if not is_authorized(message): return
    url = message.text.strip()
    start_ffmpeg_stream(url, message.chat.id)

# --- 📡 自动切换守护线程 ---
def auto_switch_loop():
    print("📡 WiFi 自动切换服务已启动")
    fail_count = 0
    
    while True:
        time.sleep(10)
        if not auto_switch_enabled: continue
        
        # 1. 检查网络连通性
        if check_internet():
            fail_count = 0
            continue
            
        fail_count += 1
        print(f"⚠️ 网络检测失败 ({fail_count}/3)")
        
        if fail_count >= 3:
            print("🚨 确认断网，开始寻找备用 WiFi...")
            current_ssid = get_current_wifi()
            scan_list = get_scan_results()
            
            # 寻找配置中存在且信号最好的 WiFi
            target_ssid = None
            for wifi in scan_list:
                ssid = wifi['ssid']
                if ssid in WIFI_CONFIG and ssid != current_ssid:
                    target_ssid = ssid
                    break # 列表已按信号排序，找到的第一个就是最好的
            
            if target_ssid:
                print(f"🔄 尝试自动切换到: {target_ssid}")
                if connect_wifi(target_ssid, WIFI_CONFIG[target_ssid]):
                    print("✅ 自动切换成功")
                    fail_count = 0
                    # 可选：通知管理员
                    # bot.send_message(ADMIN_ID, f"⚠️ 网络异常，已自动切换到 {target_ssid}")
                else:
                    print("❌ 自动切换失败")
            else:
                print("❌ 未找到可用的备用 WiFi")
                
            # 无论成功失败，都等待一段时间再重试，避免频繁切换
            time.sleep(30) 

# 启动后台线程
t = threading.Thread(target=auto_switch_loop)
t.daemon = True
t.start()

print("Bot is running...")
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
