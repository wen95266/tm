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

export const startInstall = async () => {
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

        try {
            const password = 'admin'; // Default password for auto-setup
            // Use global command
            run(`alist admin set ${password}`);
            console.log(`\x1b[32mAlist 管理员密码已设置为: ${password}\x1b[0m`);
        } catch {
            console.error("设置密码失败，可能是第一次运行需要先启动一次生成配置？");
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

        if (pipPkgs.length > 0) {
            run('pip install --upgrade pip', true);
            run(`pip install ${pipPkgs.join(' ')}`);
        } else {
            console.log("Python 依赖已安装。");
        }

        console.log("\x1b[1;33m⚠️ 重要提示: 请确保你已安装 'Termux:API' 安卓应用，并授予其'位置信息'权限，否则 WiFi 功能将无法工作！\x1b[0m");

        // --- 4. Generate bot.py ---
        console.log("\n\x1b[1;34m[4/5] 生成终极企业级 bot.py...\x1b[0m");
        const botContent = `import telebot
from telebot import types
import subprocess
import time
import threading
import json
import signal
import os
import re
import requests
import datetime
import psutil # 需安装: pip install psutil
import shutil

# --- 🚀 基础配置 ---
BOT_TOKEN = ${JSON.stringify(ENV_BOT_TOKEN)}
try:
    ADMIN_ID = int(${JSON.stringify(ENV_ADMIN_ID)})
except:
    ADMIN_ID = 0
ADMIN_IDS = [ADMIN_ID]

print(f"Bot 启动中... Token: {BOT_TOKEN[:5]}*** Admin: {ADMIN_ID}")

# --- ⚙️ 全局配置 ---
TG_RTMP_URL = 'rtmp://你的服务器地址/密钥'
ALIST_URL = 'http://127.0.0.1:5244'
ALIST_TOKEN = '' # 填入 Token 以管理存储
WIFI_CONFIG = {
    'MyHomeWifi': 'password123',
    'MyOfficeWifi': 'password456'
}
PING_TARGET = '223.5.5.5' 
ALERT_CPU = 90
ALERT_MEM = 90

bot = telebot.TeleBot(BOT_TOKEN)
stream_process = None
auto_switch_enabled = True
start_time = time.time()
last_alert_time = 0
user_states = {} 

# 设置左下角菜单命令
try:
    bot.set_my_commands([
        telebot.types.BotCommand("menu", "打开控制面板"),
        telebot.types.BotCommand("status", "查看系统状态"),
        telebot.types.BotCommand("stream", "直播推流设置"),
        telebot.types.BotCommand("cmd", "执行终端命令"),
        telebot.types.BotCommand("help", "显示帮助信息")
    ])
    print("✅ 菜单命令已设置")
except Exception as e:
    print(f"❌ 菜单设置失败: {e}")

# --- 🛠 核心工具库 ---

class SystemUtils:
    @staticmethod
    def run_cmd(cmd, timeout=30):
        try:
            return subprocess.check_output(cmd, shell=True, timeout=timeout, stderr=subprocess.STDOUT).decode('utf-8').strip()
        except subprocess.TimeoutExpired:
            return "Error: Command timed out"
        except Exception as e:
            return str(e)

    @staticmethod
    def get_status_msg():
        uptime = str(datetime.timedelta(seconds=int(time.time() - start_time)))
        cpu = psutil.cpu_percent(interval=0.5)
        mem = psutil.virtual_memory().percent
        disk = psutil.disk_usage('/').percent
        temp = "N/A"
        try:
            temp = SystemUtils.run_cmd("sensors | grep 'temp1' | head -1")
        except: pass
        
        battery = "N/A"
        try:
            bat_info = json.loads(SystemUtils.run_cmd("termux-battery-status"))
            battery = f"{bat_info.get('percentage', 'N/A')}% ({bat_info.get('status', 'N/A')})"
        except: pass
        
        return (f"📊 **Termux 全功能控制台**\\n"
                f"━━━━━━━━━━━━━━━━\\n"
                f"⏱ 运行时间: \`{uptime}\`\\n"
                f"💻 CPU负载: \`{cpu}%\`\\n"
                f"🧠 内存使用: \`{mem}%\`\\n"
                f"💾 存储使用: \`{disk}%\`\\n"
                f"🔋 电池状态: \`{battery}\`\\n"
                f"🌡 设备温度: \`{temp}\`")

class FileManager:
    @staticmethod
    def get_current_path(chat_id):
        if chat_id not in user_states:
            user_states[chat_id] = {'path': os.getcwd()}
        return user_states[chat_id]['path']

    @staticmethod
    def set_path(chat_id, path):
        if os.path.exists(path) and os.path.isdir(path):
            user_states[chat_id]['path'] = path
            return True
        return False

    @staticmethod
    def list_dir(path):
        try:
            items = os.listdir(path)
            items.sort()
            res = []
            for item in items:
                full = os.path.join(path, item)
                is_dir = os.path.isdir(full)
                size = ""
                if not is_dir:
                    try:
                        size = f" ({os.path.getsize(full) // 1024}KB)"
                    except: pass
                res.append({'name': item, 'is_dir': is_dir, 'size': size})
            return res
        except Exception as e:
            return str(e)

    @staticmethod
    def delete_item(chat_id, filename):
        path = os.path.join(FileManager.get_current_path(chat_id), filename)
        try:
            if os.path.isdir(path):
                shutil.rmtree(path)
            else:
                os.remove(path)
            return True, "已删除"
        except Exception as e:
            return False, str(e)

class NetworkUtils:
    @staticmethod
    def check_internet():
        try:
            subprocess.check_call(['ping', '-c', '1', '-W', '2', PING_TARGET], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return True
        except: return False

    @staticmethod
    def get_wifi_info():
        try:
            info = json.loads(SystemUtils.run_cmd('termux-wifi-connectioninfo'))
            return info.get('ssid', '未连接'), info.get('ip', 'Unknown')
        except: return "获取失败", "Unknown"

    @staticmethod
    def connect_wifi(ssid, pwd):
        SystemUtils.run_cmd(f'termux-wifi-connect -s "{ssid}" -p "{pwd}"')
        for _ in range(5):
            time.sleep(2)
            if NetworkUtils.get_wifi_info()[0] == ssid: return True
        return False

    @staticmethod
    def get_public_ip():
        try: return requests.get('http://ifconfig.me/ip', timeout=5).text.strip()
        except: return "获取失败"

class AlistUtils:
    @staticmethod
    def get_version():
        try:
            res = requests.get(f"{ALIST_URL}/api/public/settings", timeout=2).json()
            return res['data']['version']
        except: return "离线"

    @staticmethod
    def get_storage_list():
        if not ALIST_TOKEN: return "⚠️ 未配置 ALIST_TOKEN，无法查看存储详情"
        try:
            headers = {'Authorization': ALIST_TOKEN}
            res = requests.get(f"{ALIST_URL}/api/admin/storage/list", headers=headers, timeout=5).json()
            if res['code'] == 200:
                msg = "💾 **Alist 存储状态**\\n"
                for item in res['data']['content']:
                    status = "🟢" if item['status'] == 'work' else "🔴"
                    msg += f"{status} {item['mount_path']}\\n"
                return msg
            return f"❌ API 错误: {res.get('message')}"
        except Exception as e:
            return f"❌ 请求失败: {e}"

# --- ⌨️ 动态菜单系统 ---

def get_keyboard(menu_type, data=None, chat_id=None):
    markup = types.InlineKeyboardMarkup()
    
    if menu_type == "main":
        markup.row(
            types.InlineKeyboardButton("📂 文件管理", callback_data="fm_home"),
            types.InlineKeyboardButton("📡 网络中心", callback_data="menu_net")
        )
        markup.row(
            types.InlineKeyboardButton("📺 直播推流", callback_data="menu_stream"),
            types.InlineKeyboardButton("⚙️ 进程监控", callback_data="menu_proc")
        )
        markup.row(
            types.InlineKeyboardButton("💻 终端命令", callback_data="menu_cmd"),
            types.InlineKeyboardButton("📂 Alist", callback_data="menu_alist")
        )
        markup.row(
            types.InlineKeyboardButton("📝 系统日志", callback_data="menu_logs"),
            types.InlineKeyboardButton("🔄 刷新状态", callback_data="refresh_main")
        )

    elif menu_type == "fm":
        path = data
        markup.row(types.InlineKeyboardButton(f"📂 {path}", callback_data="noop"))
        markup.row(types.InlineKeyboardButton("⬆️ 上一级", callback_data="fm_up"))
        
        items = FileManager.list_dir(path)
        if isinstance(items, list):
            dirs = [i for i in items if i['is_dir']][:10]
            files = [i for i in items if not i['is_dir']][:10]
            for d in dirs:
                markup.add(types.InlineKeyboardButton(f"📁 {d['name']}", callback_data=f"fm_cd_{d['name']}"))
            for f in files:
                markup.add(types.InlineKeyboardButton(f"📄 {f['name']}{f['size']}", callback_data=f"fm_opt_{f['name']}"))
        else:
            markup.add(types.InlineKeyboardButton(f"❌ 错误: {items}", callback_data="noop"))
            
        markup.row(
            types.InlineKeyboardButton("📤 上传文件", callback_data="fm_upload"),
            types.InlineKeyboardButton("🔙 主菜单", callback_data="main_menu")
        )

    elif menu_type == "fm_file_opt":
        filename = data
        markup.row(types.InlineKeyboardButton(f"📄 {filename}", callback_data="noop"))
        markup.row(
            types.InlineKeyboardButton("⬇️ 下载", callback_data=f"fm_dl_{filename}"),
            types.InlineKeyboardButton("👁️ 预览文本", callback_data=f"fm_view_{filename}")
        )
        markup.row(
            types.InlineKeyboardButton("✏️ 重命名", callback_data=f"fm_ren_{filename}"),
            types.InlineKeyboardButton("🗑 删除", callback_data=f"fm_del_{filename}")
        )
        markup.row(types.InlineKeyboardButton("🔙 返回列表", callback_data="fm_back"))

    elif menu_type == "proc":
        markup.row(types.InlineKeyboardButton("🔄 刷新列表", callback_data="menu_proc"))
        markup.row(types.InlineKeyboardButton("🔙 主菜单", callback_data="main_menu"))

    elif menu_type == "net":
        ssid, ip = NetworkUtils.get_wifi_info()
        markup.row(types.InlineKeyboardButton(f"SSID: {ssid} | IP: {ip}", callback_data="refresh_net"))
        markup.row(
            types.InlineKeyboardButton("🔍 扫描 WiFi", callback_data="scan_wifi"),
            types.InlineKeyboardButton("🚀 测速", callback_data="net_speed")
        )
        markup.row(
            types.InlineKeyboardButton("🌐 公网 IP", callback_data="check_ip"),
            types.InlineKeyboardButton("🔙 主菜单", callback_data="main_menu")
        )

    elif menu_type == "alist":
        markup.row(
            types.InlineKeyboardButton("💾 存储状态", callback_data="alist_storage"),
            types.InlineKeyboardButton("🔗 查看地址", url=ALIST_URL)
        )
        markup.row(
            types.InlineKeyboardButton("🔄 重启服务", callback_data="restart_alist"),
            types.InlineKeyboardButton("🔙 主菜单", callback_data="main_menu")
        )

    elif menu_type == "stream":
        status = "🟢 推流中" if stream_process and stream_process.poll() is None else "🔴 空闲"
        markup.row(types.InlineKeyboardButton(f"状态: {status}", callback_data="noop"))
        markup.row(
            types.InlineKeyboardButton("▶️ 开始", callback_data="stream_input"),
            types.InlineKeyboardButton("⏹ 停止", callback_data="stop_stream")
        )
        markup.row(types.InlineKeyboardButton("🔙 主菜单", callback_data="main_menu"))

    return markup

# --- 🤖 交互逻辑 ---

def is_auth(msg):
    uid = msg.from_user.id if hasattr(msg, 'from_user') else msg.message.chat.id
    if int(uid) in ADMIN_IDS or ADMIN_ID == 0: return True
    print(f"Unauthorized: {uid}")
    return False

@bot.message_handler(commands=['start', 'menu'])
def menu(message):
    if not is_auth(message): return
    status = SystemUtils.get_status_msg()
    bot.send_message(message.chat.id, status, reply_markup=get_keyboard("main"), parse_mode='Markdown')

@bot.message_handler(commands=['status'])
def status_handler(message):
    if not is_auth(message): return
    status = SystemUtils.get_status_msg()
    bot.reply_to(message, status, parse_mode='Markdown')

@bot.message_handler(commands=['stream'])
def stream_handler(message):
    if not is_auth(message): return
    bot.send_message(message.chat.id, "📺 **直播控制台**", reply_markup=get_keyboard("stream"), parse_mode='Markdown')

@bot.message_handler(commands=['cmd'])
def cmd_handler(message):
    if not is_auth(message): return
    cmd = message.text.split(maxsplit=1)
    if len(cmd) > 1:
        bot.reply_to(message, f"⏳ 执行: {cmd[1]}...")
        res = SystemUtils.run_cmd(cmd[1])
        if len(res) > 3000: res = res[:3000] + "\\n...(截断)"
        bot.reply_to(message, f"\`\`\`\\n{res or '无输出'}\\n\`\`\`", parse_mode='Markdown')
    else:
        bot.reply_to(message, "用法: /cmd <命令>")

@bot.callback_query_handler(func=lambda call: True)
def callback(call):
    if not is_auth(call): return
    cid = call.message.chat.id
    mid = call.message.message_id
    d = call.data

    if d == "main_menu" or d == "refresh_main":
        bot.edit_message_text(SystemUtils.get_status_msg(), cid, mid, reply_markup=get_keyboard("main"), parse_mode='Markdown')

    # --- File Manager ---
    elif d == "fm_home":
        path = FileManager.get_current_path(cid)
        bot.edit_message_text(f"📂 **文件管理器**\\n路径: \`{path}\`", cid, mid, reply_markup=get_keyboard("fm", path), parse_mode='Markdown')
    
    elif d == "fm_up" or d == "fm_back":
        curr = FileManager.get_current_path(cid)
        if d == "fm_up":
            curr = os.path.dirname(curr)
            FileManager.set_path(cid, curr)
        bot.edit_message_text(f"📂 **文件管理器**\\n路径: \`{curr}\`", cid, mid, reply_markup=get_keyboard("fm", curr), parse_mode='Markdown')

    elif d.startswith("fm_cd_"):
        folder = d[6:]
        curr = FileManager.get_current_path(cid)
        new_path = os.path.join(curr, folder)
        if FileManager.set_path(cid, new_path):
            bot.edit_message_text(f"📂 **文件管理器**\\n路径: \`{new_path}\`", cid, mid, reply_markup=get_keyboard("fm", new_path), parse_mode='Markdown')
        else:
            bot.answer_callback_query(call.id, "无法进入目录")

    elif d.startswith("fm_opt_"):
        filename = d[7:]
        bot.edit_message_text(f"📄 **文件操作**: {filename}", cid, mid, reply_markup=get_keyboard("fm_file_opt", filename))

    elif d.startswith("fm_dl_"):
        filename = d[6:]
        path = os.path.join(FileManager.get_current_path(cid), filename)
        bot.answer_callback_query(call.id, "正在发送...")
        try:
            with open(path, 'rb') as f: bot.send_document(cid, f)
        except Exception as e: bot.send_message(cid, f"❌ 失败: {e}")

    elif d.startswith("fm_view_"):
        filename = d[8:]
        path = os.path.join(FileManager.get_current_path(cid), filename)
        try:
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read(4000) # Telegram message limit is 4096
                if len(content) == 4000: content += "\\n... (截断)"
                bot.send_message(cid, f"📄 **{filename}**\\n\`\`\`text\\n{content}\\n\`\`\`", parse_mode='Markdown')
        except UnicodeDecodeError:
            bot.answer_callback_query(call.id, "❌ 无法预览非文本文件", show_alert=True)
        except Exception as e:
            bot.send_message(cid, f"❌ 读取失败: {e}")

    elif d.startswith("fm_del_"):
        filename = d[7:]
        success, msg = FileManager.delete_item(cid, filename)
        bot.answer_callback_query(call.id, msg, show_alert=True)
        if success:
            path = FileManager.get_current_path(cid)
            bot.edit_message_text(f"📂 **文件管理器**\\n路径: \`{path}\`", cid, mid, reply_markup=get_keyboard("fm", path), parse_mode='Markdown')

    elif d.startswith("fm_ren_"):
        filename = d[7:]
        msg = bot.send_message(cid, f"✏️ 请输入 \`{filename}\` 的新名称:", parse_mode='Markdown')
        bot.register_next_step_handler(msg, lambda m: handle_rename(m, filename))

    elif d == "fm_upload":
        msg = bot.send_message(cid, "📤 请直接发送文件给我，它将保存到当前目录。")
        bot.register_next_step_handler(msg, handle_upload)

    # --- Process Manager ---
    elif d == "menu_proc":
        procs = []
        for p in psutil.process_iter(['pid', 'name', 'username', 'memory_percent']):
            try:
                if p.info['memory_percent'] > 0.5: # 只显示占用内存>0.5%的
                    procs.append(p.info)
            except: pass
        
        procs.sort(key=lambda x: x['memory_percent'], reverse=True)
        msg = "⚙️ **Top 进程 (内存)**\\n\\n"
        for p in procs[:10]:
            msg += f"\`{p['pid']}\` | {p['name']} | {p['memory_percent']:.1f}%\\n"
        
        bot.edit_message_text(msg, cid, mid, reply_markup=get_keyboard("proc"), parse_mode='Markdown')

    # --- Network ---
    elif d == "menu_net":
        bot.edit_message_text("📡 **网络中心**", cid, mid, reply_markup=get_keyboard("net"))
    
    elif d == "check_ip":
        ip = NetworkUtils.get_public_ip()
        bot.answer_callback_query(call.id, f"IP: {ip}", show_alert=True)

    elif d == "net_speed":
        bot.answer_callback_query(call.id, "正在测速，请稍候...", show_alert=False)
        bot.send_message(cid, "🚀 正在运行 Speedtest...")
        threading.Thread(target=lambda: bot.send_message(cid, f"📊 **测速结果**\\n\`\`\`\\n{SystemUtils.run_cmd('speedtest-cli --simple')}\\n\`\`\`", parse_mode='Markdown')).start()

    # --- Alist ---
    elif d == "menu_alist":
        ver = AlistUtils.get_version()
        bot.edit_message_text(f"📂 **Alist 管理**\\n版本: {ver}", cid, mid, reply_markup=get_keyboard("alist"))

    elif d == "alist_storage":
        status = AlistUtils.get_storage_list()
        bot.send_message(cid, status, parse_mode='Markdown')

    elif d == "restart_alist":
        bot.answer_callback_query(call.id, "重启中...")
        SystemUtils.run_cmd("pm2 restart alist")

    # --- Stream ---
    elif d == "menu_stream":
        bot.edit_message_text("📺 **直播控制台**", cid, mid, reply_markup=get_keyboard("stream"))
    
    elif d == "stream_input":
        msg = bot.send_message(cid, "🔗 请回复直播源链接:")
        bot.register_next_step_handler(msg, lambda m: start_ffmpeg_stream(m.text.strip(), cid))
    
    elif d == "stop_stream":
        global stream_process
        if stream_process:
            stop_stream_process(stream_process)
            stream_process = None
            bot.answer_callback_query(call.id, "已停止")
        bot.edit_message_reply_markup(cid, mid, reply_markup=get_keyboard("stream"))

    # --- Cmd & Logs ---
    elif d == "menu_cmd":
        msg = bot.send_message(cid, "💻 请输入 Shell 命令:")
        bot.register_next_step_handler(msg, lambda m: bot.reply_to(m, f"\`\`\`\\n{SystemUtils.run_cmd(m.text)}\\n\`\`\`", parse_mode='Markdown'))

    elif d == "menu_logs":
        log = SystemUtils.run_cmd("pm2 logs bot --lines 15 --nostream")
        bot.send_message(cid, f"📝 **Bot Logs**\\n\`\`\`\\n{log}\\n\`\`\`", parse_mode='Markdown')

def handle_upload(message):
    if not is_auth(message): return
    if not message.document:
        bot.reply_to(message, "❌ 未检测到文件")
        return
    
    try:
        file_info = bot.get_file(message.document.file_id)
        downloaded = bot.download_file(file_info.file_path)
        path = os.path.join(FileManager.get_current_path(message.chat.id), message.document.file_name)
        
        with open(path, 'wb') as new_file:
            new_file.write(downloaded)
        bot.reply_to(message, f"✅ 文件已保存: \`{message.document.file_name}\`", parse_mode='Markdown')
    except Exception as e:
        bot.reply_to(message, f"❌ 上传失败: {e}")

def handle_rename(message, old_name):
    if not is_auth(message): return
    new_name = message.text.strip()
    path = FileManager.get_current_path(message.chat.id)
    old_path = os.path.join(path, old_name)
    new_path = os.path.join(path, new_name)
    try:
        os.rename(old_path, new_path)
        bot.reply_to(message, "✅ 重命名成功")
    except Exception as e:
        bot.reply_to(message, f"❌ 失败: {e}")

# --- Helpers ---
def start_ffmpeg_stream(url, cid):
    global stream_process
    if stream_process: stop_stream_process(stream_process)
    bot.send_message(cid, "🚀 启动推流...")
    cmd = ['ffmpeg', '-re', '-i', url, '-c:v', 'libx264', '-preset', 'ultrafast', '-f', 'flv', TG_RTMP_URL]
    stream_process = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, preexec_fn=os.setsid)

def stop_stream_process(proc):
    try: os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
    except: pass

# --- Monitor ---
def monitor():
    global last_alert_time
    while True:
        time.sleep(10)
        if auto_switch_enabled and not NetworkUtils.check_internet():
            for ssid, pwd in WIFI_CONFIG.items():
                if NetworkUtils.connect_wifi(ssid, pwd):
                    try:
                        if ADMIN_ID != 0:
                            bot.send_message(ADMIN_ID, f"🔄 自动切换 WiFi 成功: {ssid}")
                    except: pass
                    break
        
        if time.time() - last_alert_time > 300:
            if psutil.cpu_percent() > ALERT_CPU:
                try:
                    if ADMIN_ID != 0:
                        bot.send_message(ADMIN_ID, f"🚨 CPU 报警: {psutil.cpu_percent()}%")
                except: pass
                last_alert_time = time.time()

t = threading.Thread(target=monitor)
t.daemon = True
t.start()

# 防止 Android 休眠杀后台
try:
    SystemUtils.run_cmd("termux-wake-lock")
    print("Wake lock acquired.")
except:
    pass

print("Bot started. Polling...")
try:
    bot.remove_webhook()
except:
    pass

while True:
    try:
        bot.infinity_polling(timeout=10, long_polling_timeout=5)
    except Exception as e:
        print(f"Polling error: {e}")
        time.sleep(5)
`;

        fs.writeFileSync('bot.py', botContent);
        console.log("bot.py 已生成。");

        // --- 5. PM2 Configuration ---
        console.log("\n\x1b[1;34m[5/5] 配置 PM2 自动启动...\x1b[0m");
        try {
            execSync('command -v pm2', { stdio: 'ignore' });
            console.log("PM2 已安装。");
        } catch {
            run('npm install pm2 -g');
        }

        // Stop existing PM2 processes to avoid duplicates
        run('pm2 delete alist', true);
        run('pm2 delete bot', true);

        // Start processes
        // Get alist path
        let alistPath = 'alist';
        try {
            alistPath = execSync('which alist').toString().trim();
        } catch {
            console.warn("Could not find alist in PATH, assuming 'alist'");
        }
        run(`pm2 start ${alistPath} --name alist -- server`);
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