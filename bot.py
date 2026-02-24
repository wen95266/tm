import telebot
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
import logging

# --- 🔧 加载环境变量 ---
def load_env():
    try:
        with open('.env', 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    parts = line.split('=', 1)
                    if len(parts) == 2:
                        os.environ[parts[0].strip()] = parts[1].strip()
    except Exception as e:
        print(f"Warning: Failed to load .env file: {e}")

load_env()

# --- 🚀 基础配置 ---
BOT_TOKEN = os.environ.get('BOT_TOKEN', '')
try:
    ADMIN_ID = int(os.environ.get('ADMIN_ID', '0'))
except:
    ADMIN_ID = 0
ADMIN_IDS = [ADMIN_ID]

print(f"Bot 启动中... Token: {BOT_TOKEN[:5]}*** Admin: {ADMIN_ID}")

# --- ⚙️ 全局配置 ---
TG_RTMP_URL = os.environ.get('RTMP_URL', '')
ALIST_URL = 'http://127.0.0.1:5244'

def get_alist_token():
    load_env() # Reload env to get the latest token if updated
    return os.environ.get('ALIST_TOKEN', '')

ALIST_TOKEN = get_alist_token()
print(f"Alist Token Configured: {bool(ALIST_TOKEN)} (Length: {len(ALIST_TOKEN)})")
if ALIST_TOKEN:
    print(f"Alist Token Prefix: {ALIST_TOKEN[:5]}...")

from telebot import apihelper

def check_telegram_connection():
    try:
        requests.get("https://api.telegram.org", timeout=3)
        return True
    except:
        return False

def auto_setup_proxy():
    if check_telegram_connection():
        return
    
    print("⚠️ 无法直连 Telegram API (可能是 Termux DNS 解析失败)，正在尝试自动检测本地 VPN 代理...")
    # 常见安卓代理软件的 HTTP 端口: Clash(7890), V2RayNG(10809), NekoBox(2080), Surfboard(25500)
    common_ports = [7890, 10809, 2080, 25500, 8080, 1080, 8234]
    for port in common_ports:
        proxy_url = f"http://127.0.0.1:{port}"
        try:
            requests.get("https://api.telegram.org", proxies={"http": proxy_url, "https": proxy_url}, timeout=2)
            apihelper.proxy = {'http': proxy_url, 'https': proxy_url}
            print(f"✅ 成功自动匹配并配置本地代理: {proxy_url}")
            return
        except:
            continue
            
    print("❌ 自动检测代理失败。如果您的手机已开启 VPN，请尝试在 VPN 软件中开启 'TUN 模式' (或称 '路由模式' / 'Fake-IP')。")

auto_setup_proxy()

WIFI_CONFIG = {}
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
        except subprocess.CalledProcessError as e:
            return e.output.decode('utf-8').strip() if e.output else str(e)
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
        
        return (f"📊 **Termux 全功能控制台**\n"
                f"━━━━━━━━━━━━━━━━\n"
                f"⏱ 运行时间: `{uptime}`\n"
                f"💻 CPU负载: `{cpu}%`\n"
                f"🧠 内存使用: `{mem}%`\n"
                f"💾 存储使用: `{disk}%`\n"
                f"🔋 电池状态: `{battery}`\n"
                f"🌡 设备温度: `{temp}`")

class FileManager:
    @staticmethod
    def get_current_path(chat_id):
        if chat_id not in user_states:
            user_states[chat_id] = {'path': '/'}
        return user_states[chat_id]['path']

    @staticmethod
    def set_path(chat_id, path):
        user_states[chat_id]['path'] = path
        return True

    @staticmethod
    def list_dir(chat_id, path):
        token = get_alist_token()
        if not token: return "⚠️ 未配置 ALIST_TOKEN。请在控制台运行 'npm start' 并选择选项 8 来自动配置 Token。"
        try:
            headers = {'Authorization': token}
            payload = {"path": path, "refresh": True}
            resp = requests.post(f"{ALIST_URL}/api/fs/list", json=payload, headers=headers, timeout=10)
            
            try:
                res = resp.json()
            except:
                return f"❌ API 解析错误: {resp.text[:100]}"

            if res.get('code') == 200:
                items = res['data']['content'] or []
                res_items = []
                for item in items:
                    is_dir = item['is_dir']
                    size = ""
                    if not is_dir:
                        size = f" ({item['size'] // 1024}KB)"
                    res_items.append({'name': item['name'], 'is_dir': is_dir, 'size': size})
                user_states[chat_id]['items'] = res_items
                return res_items
            
            error_msg = f"❌ API 错误 ({res.get('code')}): {res.get('message')}"
            if res.get('code') == 401:
                error_msg += "\n\n💡 提示: 您的 Alist Token 已失效 (可能是因为重置了密码)。请在控制台主菜单选择【8】重新获取 Token。"
            return error_msg
        except Exception as e:
            return f"❌ 请求异常: {str(e)}"

    @staticmethod
    def get_item_by_idx(chat_id, idx):
        try:
            return user_states[chat_id]['items'][int(idx)]['name']
        except:
            return None

    @staticmethod
    def get_file_url(path):
        token = get_alist_token()
        if not token: return None
        try:
            headers = {'Authorization': token}
            res = requests.post(f"{ALIST_URL}/api/fs/get", json={"path": path}, headers=headers, timeout=5).json()
            if res['code'] == 200:
                return res['data']['raw_url']
            return None
        except:
            return None

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

    @staticmethod
    def get_lan_ip():
        try:
            import socket
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except:
            return "127.0.0.1"

class AlistUtils:
    @staticmethod
    def get_version():
        try:
            res = requests.get(f"{ALIST_URL}/api/public/settings", timeout=2).json()
            return res['data']['version']
        except: return "离线"

    @staticmethod
    def get_storage_list():
        token = get_alist_token()
        if not token: return "⚠️ 未配置 ALIST_TOKEN。请在控制台运行 'npm start' 并选择选项 8 来自动配置 Token。"
        try:
            headers = {'Authorization': token}
            res = requests.get(f"{ALIST_URL}/api/admin/storage/list", headers=headers, timeout=5).json()
            if res['code'] == 200:
                msg = "💾 **Alist 存储状态**\n"
                for item in res['data']['content']:
                    status = "🟢" if item['status'] == 'work' else "🔴"
                    msg += f"{status} {item['mount_path']}\n"
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
            types.InlineKeyboardButton("📝 系统日志", callback_data="menu_logs"),
            types.InlineKeyboardButton("📂 Alist", callback_data="menu_alist")
        )
        markup.row(
            types.InlineKeyboardButton("🔄 刷新状态", callback_data="refresh_main")
        )

    elif menu_type == "fm":
        path = data
        markup.row(types.InlineKeyboardButton(f"📂 {path}", callback_data="noop"))
        markup.row(types.InlineKeyboardButton("⬆️ 上一级", callback_data="fm_up"))
        
        items = FileManager.list_dir(chat_id, path)
        if isinstance(items, list):
            for idx, item in enumerate(items[:20]): # Show up to 20 items
                if item['is_dir']:
                    markup.add(types.InlineKeyboardButton(f"📁 {item['name']}", callback_data=f"fm_cd_{idx}"))
                else:
                    markup.add(types.InlineKeyboardButton(f"📄 {item['name']}{item['size']}", callback_data=f"fm_opt_{idx}"))
        else:
            markup.add(types.InlineKeyboardButton(f"❌ 错误: {items}", callback_data="noop"))
            
        markup.row(
            types.InlineKeyboardButton("🔄 刷新", callback_data="fm_refresh"),
            types.InlineKeyboardButton("🔙 主菜单", callback_data="main_menu")
        )

    elif menu_type == "fm_file_opt":
        idx = data
        filename = FileManager.get_item_by_idx(chat_id, idx) or "Unknown"
        markup.row(types.InlineKeyboardButton(f"📄 {filename}", callback_data="noop"))
        markup.row(
            types.InlineKeyboardButton("▶️ 推流直播", callback_data=f"fm_stream_{idx}"),
            types.InlineKeyboardButton("🔗 获取直链", callback_data=f"fm_link_{idx}")
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
            types.InlineKeyboardButton("🔑 重置密码", callback_data="alist_reset_pwd"),
            types.InlineKeyboardButton("📝 查看日志", callback_data="alist_logs")
        )
        markup.row(
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
        if len(res) > 3000: res = res[:3000] + "\n...(截断)"
        bot.reply_to(message, f"```\n{res or '无输出'}\n```", parse_mode='Markdown')
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
        bot.edit_message_text(f"📂 **文件管理器**\n路径: `{path}`", cid, mid, reply_markup=get_keyboard("fm", path), parse_mode='Markdown')
    
    elif d == "fm_up" or d == "fm_back":
        curr = FileManager.get_current_path(cid)
        if d == "fm_up":
            if curr != '/':
                curr = os.path.dirname(curr).replace('\\', '/')
                if curr == '': curr = '/'
            FileManager.set_path(cid, curr)
        bot.edit_message_text(f"📂 **文件管理器**\n路径: `{curr}`", cid, mid, reply_markup=get_keyboard("fm", curr), parse_mode='Markdown')

    elif d.startswith("fm_cd_"):
        idx = d[6:]
        folder = FileManager.get_item_by_idx(cid, idx)
        if folder:
            curr = FileManager.get_current_path(cid)
            new_path = os.path.join(curr, folder).replace('\\', '/')
            if FileManager.set_path(cid, new_path):
                bot.edit_message_text(f"📂 **文件管理器**\n路径: `{new_path}`", cid, mid, reply_markup=get_keyboard("fm", new_path), parse_mode='Markdown')
            else:
                bot.answer_callback_query(call.id, "无法进入目录")
        else:
            bot.answer_callback_query(call.id, "目录不存在")

    elif d.startswith("fm_opt_"):
        idx = d[7:]
        filename = FileManager.get_item_by_idx(cid, idx)
        if filename:
            bot.edit_message_text(f"📄 **文件操作**: {filename}", cid, mid, reply_markup=get_keyboard("fm_file_opt", idx))
        else:
            bot.answer_callback_query(call.id, "文件不存在")

    elif d.startswith("fm_stream_"):
        idx = d[10:]
        filename = FileManager.get_item_by_idx(cid, idx)
        if not filename: return bot.answer_callback_query(call.id, "文件不存在")
        path = os.path.join(FileManager.get_current_path(cid), filename).replace('\\', '/')
        url = FileManager.get_file_url(path)
        if url:
            bot.answer_callback_query(call.id, "准备推流...")
            start_ffmpeg_stream(url, cid)
        else:
            bot.answer_callback_query(call.id, "无法获取直链，请检查 Alist 配置", show_alert=True)

    elif d.startswith("fm_link_"):
        idx = d[8:]
        filename = FileManager.get_item_by_idx(cid, idx)
        if not filename: return bot.answer_callback_query(call.id, "文件不存在")
        path = os.path.join(FileManager.get_current_path(cid), filename).replace('\\', '/')
        url = FileManager.get_file_url(path)
        if url:
            bot.send_message(cid, f"🔗 **{filename} 直链:**\n`{url}`", parse_mode='Markdown')
            bot.answer_callback_query(call.id, "直链已发送")
        else:
            bot.answer_callback_query(call.id, "无法获取直链，请检查 Alist 配置", show_alert=True)

    elif d == "fm_refresh":
        path = FileManager.get_current_path(cid)
        bot.edit_message_text(f"📂 **文件管理器**\n路径: `{path}`", cid, mid, reply_markup=get_keyboard("fm", path), parse_mode='Markdown')

    # --- Process Manager ---
    elif d == "menu_proc":
        procs = []
        for p in psutil.process_iter(['pid', 'name', 'username', 'memory_percent']):
            try:
                if p.info['memory_percent'] > 0.5: # 只显示占用内存>0.5%的
                    procs.append(p.info)
            except: pass
        
        procs.sort(key=lambda x: x['memory_percent'], reverse=True)
        msg = "⚙️ **Top 进程 (内存)**\n\n"
        for p in procs[:10]:
            msg += f"`{p['pid']}` | {p['name']} | {p['memory_percent']:.1f}%\n"
        
        bot.edit_message_text(msg, cid, mid, reply_markup=get_keyboard("proc"), parse_mode='Markdown')

    # --- Network ---
    elif d == "menu_net" or d == "refresh_net":
        bot.edit_message_text("📡 **网络中心**", cid, mid, reply_markup=get_keyboard("net"))
    
    elif d == "scan_wifi":
        bot.answer_callback_query(call.id, "正在扫描 WiFi...", show_alert=False)
        try:
            res = SystemUtils.run_cmd('termux-wifi-scaninfo')
            info = json.loads(res)
            msg = "🔍 **WiFi 扫描结果**\n"
            for w in info[:10]:
                msg += f"📶 {w.get('ssid', 'Hidden')} ({w.get('rssi', 0)}dBm)\n"
            bot.send_message(cid, msg, parse_mode='Markdown')
        except Exception as e:
            bot.send_message(cid, f"❌ 扫描失败: {e}")

    elif d == "check_ip":
        ip = NetworkUtils.get_public_ip()
        bot.answer_callback_query(call.id, f"IP: {ip}", show_alert=True)

    elif d == "net_speed":
        bot.answer_callback_query(call.id, "正在测速，请稍候...", show_alert=False)
        bot.send_message(cid, "🚀 正在运行 Speedtest...")
        threading.Thread(target=lambda: bot.send_message(cid, f"📊 **测速结果**\n```\n{SystemUtils.run_cmd('speedtest-cli --simple')}\n```", parse_mode='Markdown')).start()

    # --- Alist ---
    elif d == "menu_alist":
        ver = AlistUtils.get_version()
        lan_ip = NetworkUtils.get_lan_ip()
        bot.edit_message_text(f"📂 **Alist 管理**\n版本: {ver}\n内网地址: http://{lan_ip}:5244", cid, mid, reply_markup=get_keyboard("alist"))

    elif d == "alist_storage":
        status = AlistUtils.get_storage_list()
        bot.send_message(cid, status, parse_mode='Markdown')

    elif d == "alist_reset_pwd":
        bot.answer_callback_query(call.id, "正在重置密码...", show_alert=True)
        try:
            # Try to stop alist first to release db lock if any
            SystemUtils.run_cmd("pm2 stop alist")
            time.sleep(2)
            # Run reset command
            res = SystemUtils.run_cmd("alist admin set admin")
            # Restart
            SystemUtils.run_cmd("pm2 restart alist")
            bot.send_message(cid, f"✅ **密码重置结果**\n```\n{res}\n```\n默认密码: `admin`\n请稍候几秒再尝试登录。\n\n⚠️ **注意**: 密码重置后，原有的 Token 会失效。请在 Termux 控制台主菜单运行【8】重新获取 Token，否则文件管理功能将无法使用！", parse_mode='Markdown')
        except Exception as e:
            bot.send_message(cid, f"❌ 重置失败: {e}")
            SystemUtils.run_cmd("pm2 restart alist")

    elif d == "alist_logs":
        log = SystemUtils.run_cmd("pm2 logs alist --lines 20 --nostream --no-color")
        bot.send_message(cid, f"📝 **Alist Logs**\n```\n{log}\n```", parse_mode='Markdown')

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

    elif d == "menu_logs":
        bot_log = SystemUtils.run_cmd("pm2 logs bot --lines 15 --nostream --no-color")
        alist_log = SystemUtils.run_cmd("pm2 logs alist --lines 15 --nostream --no-color")
        bot.send_message(cid, f"📝 **Bot Logs**\n```\n{bot_log}\n```\n\n📝 **Alist Logs**\n```\n{alist_log}\n```", parse_mode='Markdown')

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

telebot.logger.setLevel(logging.INFO)

print("Bot started. Polling...")
try:
    bot.remove_webhook()
except:
    pass

while True:
    try:
        # Use allowed_updates to avoid processing unnecessary updates and potentially fix polling issues
        # skip_pending=True to ignore old updates that might be causing issues
        bot.infinity_polling(timeout=20, long_polling_timeout=10, allowed_updates=telebot.util.update_types, skip_pending=True)
    except Exception as e:
        print(f"Polling error: {e}")
        time.sleep(15)
