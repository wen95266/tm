import telebot
import time
import threading
import signal
import os
import json
import psutil
import logging
from modules.config import BOT_TOKEN, ADMIN_ID, ADMIN_IDS, TG_RTMP_URL, ALIST_URL, WIFI_CONFIG, ALERT_CPU, ALERT_MEM
from modules.utils import SystemUtils, NetworkUtils
from modules.alist import FileManager, AlistUtils
from modules.menus import get_keyboard
from modules.monitor import Monitor
from modules.stream import StreamManager
import subprocess

# --- 🤖 初始化 ---
bot = telebot.TeleBot(BOT_TOKEN)
stream_process = None
start_time = time.time()
user_states = {} 

# 启动监控
monitor_system = Monitor(bot)
monitor_system.start()

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

# --- 🤖 交互逻辑 ---

def is_auth(msg):
    uid = msg.from_user.id if hasattr(msg, 'from_user') else msg.message.chat.id
    if int(uid) in ADMIN_IDS or ADMIN_ID == 0: return True
    print(f"Unauthorized: {uid}")
    return False

@bot.message_handler(commands=['start', 'menu'])
def menu(message):
    if not is_auth(message): return
    status = SystemUtils.get_status_msg(start_time)
    bot.send_message(message.chat.id, status, reply_markup=get_keyboard("main"), parse_mode='Markdown')

@bot.message_handler(commands=['status'])
def status_handler(message):
    if not is_auth(message): return
    status = SystemUtils.get_status_msg(start_time)
    bot.reply_to(message, status, parse_mode='Markdown')

@bot.message_handler(commands=['stream'])
def stream_handler(message):
    if not is_auth(message): return
    bot.send_message(message.chat.id, "📺 **直播控制台**", reply_markup=get_keyboard("stream", stream_process=stream_process), parse_mode='Markdown')

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

@bot.message_handler(commands=['help'])
def help_handler(message):
    if not is_auth(message): return
    help_text = (
        "📖 **Termux Alist Bot 帮助手册**\n\n"
        "🔹 **基础命令**\n"
        "• /menu - 打开图形化控制面板\n"
        "• /status - 快速查看系统状态\n"
        "• /stream - 直播推流控制\n"
        "• /cmd <命令> - 执行终端命令\n\n"
        "🔹 **功能说明**\n"
        "• **文件管理**: 浏览 Alist 文件，支持获取直链、推流直播、删除文件。\n"
        "• **网络中心**: WiFi 扫描、自动切换、测速、查看 IP。\n"
        "• **进程监控**: 查看系统资源占用最高的进程。\n"
        "• **Alist 管理**: 存储状态查看、密码重置、日志查看。\n\n"
        "💡 *提示: 建议在手机上开启 VPN 的 TUN 模式以保证 Bot 连接稳定。*"
    )
    bot.send_message(message.chat.id, help_text, parse_mode='Markdown')

@bot.callback_query_handler(func=lambda call: True)
def callback(call):
    if not is_auth(call): return
    cid = call.message.chat.id
    mid = call.message.message_id
    d = call.data

    if d == "main_menu" or d == "refresh_main":
        bot.edit_message_text(SystemUtils.get_status_msg(start_time), cid, mid, reply_markup=get_keyboard("main"), parse_mode='Markdown')

    # --- File Manager ---
    elif d == "fm_home":
        path = FileManager.get_current_path(user_states, cid)
        FileManager.list_dir(user_states, cid, path) # Refresh items
        bot.edit_message_text(f"📂 **文件管理器**\n路径: `{path}`", cid, mid, reply_markup=get_keyboard("fm", user_states, path, cid), parse_mode='Markdown')
    
    elif d == "fm_refresh":
        path = FileManager.get_current_path(user_states, cid)
        FileManager.list_dir(user_states, cid, path)
        bot.edit_message_text(f"📂 **文件管理器**\n路径: `{path}`", cid, mid, reply_markup=get_keyboard("fm", user_states, path, cid), parse_mode='Markdown')

    elif d == "fm_next" or d == "fm_prev":
        if cid in user_states:
            if d == "fm_next": user_states[cid]['page'] += 1
            else: user_states[cid]['page'] -= 1
            path = FileManager.get_current_path(user_states, cid)
            bot.edit_message_text(f"📂 **文件管理器**\n路径: `{path}`", cid, mid, reply_markup=get_keyboard("fm", user_states, path, cid), parse_mode='Markdown')

    elif d == "fm_up" or d == "fm_back":
        curr = FileManager.get_current_path(user_states, cid)
        if d == "fm_up":
            if curr != '/':
                curr = os.path.dirname(curr).replace('\\', '/')
                if curr == '': curr = '/'
            FileManager.set_path(user_states, cid, curr)
            FileManager.list_dir(user_states, cid, curr)
        bot.edit_message_text(f"📂 **文件管理器**\n路径: `{curr}`", cid, mid, reply_markup=get_keyboard("fm", user_states, curr, cid), parse_mode='Markdown')

    elif d.startswith("fm_cd_"):
        idx = d[6:]
        folder = FileManager.get_item_by_idx(user_states, cid, idx)
        if folder:
            curr = FileManager.get_current_path(user_states, cid)
            new_path = os.path.join(curr, folder).replace('\\', '/')
            if FileManager.set_path(user_states, cid, new_path):
                FileManager.list_dir(user_states, cid, new_path)
                bot.edit_message_text(f"📂 **文件管理器**\n路径: `{new_path}`", cid, mid, reply_markup=get_keyboard("fm", user_states, new_path, cid), parse_mode='Markdown')
            else:
                bot.answer_callback_query(call.id, "无法进入目录")
        else:
            bot.answer_callback_query(call.id, "目录不存在")

    elif d.startswith("fm_opt_"):
        idx = d[7:]
        filename = FileManager.get_item_by_idx(user_states, cid, idx)
        if filename:
            bot.edit_message_text(f"📄 **文件操作**: {filename}", cid, mid, reply_markup=get_keyboard("fm_file_opt", user_states, idx, cid))
        else:
            bot.answer_callback_query(call.id, "文件不存在")

    elif d.startswith("fm_del_conf_"):
        idx = d[12:]
        bot.edit_message_text("⚠️ **确认删除?**", cid, mid, reply_markup=get_keyboard("fm_del_conf", user_states, idx, cid))

    elif d.startswith("fm_del_exec_"):
        idx = d[12:]
        filename = FileManager.get_item_by_idx(user_states, cid, idx)
        if filename:
            path = os.path.join(FileManager.get_current_path(user_states, cid), filename).replace('\\', '/')
            if FileManager.delete_file(path):
                bot.answer_callback_query(call.id, "✅ 文件已删除", show_alert=True)
                # Refresh list
                curr = FileManager.get_current_path(user_states, cid)
                FileManager.list_dir(user_states, cid, curr)
                bot.edit_message_text(f"📂 **文件管理器**\n路径: `{curr}`", cid, mid, reply_markup=get_keyboard("fm", user_states, curr, cid), parse_mode='Markdown')
            else:
                bot.answer_callback_query(call.id, "❌ 删除失败", show_alert=True)
        else:
            bot.answer_callback_query(call.id, "文件不存在")

    elif d.startswith("fm_stream_"):
        idx = d[10:]
        filename = FileManager.get_item_by_idx(user_states, cid, idx)
        if not filename: return bot.answer_callback_query(call.id, "文件不存在")
        bot.edit_message_text(f"为 {filename} 选择推流密钥:", cid, mid, reply_markup=get_keyboard("stream_select_key", user_states, idx, cid))

    elif d.startswith("fm_link_"):
        idx = d[8:]
        filename = FileManager.get_item_by_idx(user_states, cid, idx)
        if not filename: return bot.answer_callback_query(call.id, "文件不存在")
        path = os.path.join(FileManager.get_current_path(user_states, cid), filename).replace('\\', '/')
        url = FileManager.get_file_url(path)
        if url:
            bot.send_message(cid, f"🔗 **{filename} 直链:**\n`{url}`", parse_mode='Markdown')
            bot.answer_callback_query(call.id, "直链已发送")
        else:
            bot.answer_callback_query(call.id, "无法获取直链，请检查 Alist 配置", show_alert=True)

    elif d == "fm_refresh":
        path = FileManager.get_current_path(user_states, cid)
        bot.edit_message_text(f"📂 **文件管理器**\n路径: `{path}`", cid, mid, reply_markup=get_keyboard("fm", user_states, path, cid), parse_mode='Markdown')

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
            SystemUtils.run_cmd("pm2 stop alist")
            time.sleep(2)
            res = SystemUtils.run_cmd("alist admin set admin")
            SystemUtils.run_cmd("pm2 restart alist")
            bot.send_message(cid, f"✅ **密码重置结果**\n```\n{res}\n```\n默认密码: `admin`\n请稍候几秒再尝试登录。\n\n⚠️ **注意**: 密码重置后，原有的 Token 会失效。请在 Termux 控制台主菜单运行【6】重新获取 Token，否则文件管理功能将无法使用！", parse_mode='Markdown')
        except Exception as e:
            bot.send_message(cid, f"❌ 重置失败: {e}")
            SystemUtils.run_cmd("pm2 restart alist")

    elif d == "alist_logs":
        log = SystemUtils.run_cmd("pm2 logs alist --lines 20 --nostream --no-color")
        bot.send_message(cid, f"📝 **Alist Logs**\n```\n{log}\n```", parse_mode='Markdown')

    # --- Stream ---
    elif d == "menu_stream":
        bot.edit_message_text("📺 **直播控制台**", cid, mid, reply_markup=get_keyboard("stream", stream_process=stream_process))
    
    elif d == "stream_add_key":
        msg = bot.send_message(cid, "➕ 请输入新密钥的名称 (例如: 频道1):")
        bot.register_next_step_handler(msg, lambda m: process_add_key_name(m, cid))

    elif d.startswith("stream_del_"):
        name = d[11:]
        if StreamManager.remove_key(name):
            bot.answer_callback_query(call.id, f"已删除密钥: {name}")
        else:
            bot.answer_callback_query(call.id, "删除失败")
        bot.edit_message_text("📺 **直播控制台**", cid, mid, reply_markup=get_keyboard("stream", stream_process=stream_process))

    elif d.startswith("stream_exec_"):
        parts = d[12:].split('_', 1)
        if len(parts) == 2:
            idx, key_name = parts
            filename = FileManager.get_item_by_idx(user_states, cid, idx)
            if not filename: return bot.answer_callback_query(call.id, "文件不存在")
            path = os.path.join(FileManager.get_current_path(user_states, cid), filename).replace('\\', '/')
            url = FileManager.get_file_url(path)
            if url:
                stream_key = StreamManager.get_key(key_name)
                if stream_key:
                    bot.answer_callback_query(call.id, f"准备推流到 {key_name}...")
                    start_ffmpeg_stream(url, cid, stream_key)
                else:
                    bot.answer_callback_query(call.id, "密钥不存在", show_alert=True)
            else:
                bot.answer_callback_query(call.id, "无法获取直链，请检查 Alist 配置", show_alert=True)

    elif d.startswith("stream_use_"):
        name = d[11:]
        stream_key = StreamManager.get_key(name)
        if stream_key:
            msg = bot.send_message(cid, f"🔗 请回复要推流到 `{name}` 的直播源链接:", parse_mode='Markdown')
            bot.register_next_step_handler(msg, lambda m: start_ffmpeg_stream(m.text.strip(), cid, stream_key))
        else:
            bot.answer_callback_query(call.id, "密钥不存在", show_alert=True)

    elif d == "stream_input":
        msg = bot.send_message(cid, "🔗 请回复临时直播源链接:")
        bot.register_next_step_handler(msg, lambda m: start_ffmpeg_stream(m.text.strip(), cid, TG_RTMP_URL))
    
    elif d == "stop_stream":
        if stream_process:
            stop_stream_process(stream_process)
            stream_process = None
            bot.answer_callback_query(call.id, "已停止")
        bot.edit_message_reply_markup(cid, mid, reply_markup=get_keyboard("stream", stream_process=stream_process))

    elif d == "menu_logs":
        bot_log = SystemUtils.run_cmd("pm2 logs bot --lines 15 --nostream --no-color")
        alist_log = SystemUtils.run_cmd("pm2 logs alist --lines 15 --nostream --no-color")
        bot.send_message(cid, f"📝 **Bot Logs**\n```\n{bot_log}\n```\n\n📝 **Alist Logs**\n```\n{alist_log}\n```", parse_mode='Markdown')

# --- Helpers ---
def process_add_key_name(message, cid):
    name = message.text.strip()
    if not name: return bot.send_message(cid, "名称不能为空")
    msg = bot.send_message(cid, f"请输入 `{name}` 的推流密钥 (例如: `1234-5678-90ab-cdef`):", parse_mode='Markdown')
    bot.register_next_step_handler(msg, lambda m: process_add_key_value(m, cid, name))

def process_add_key_value(message, cid, name):
    key = message.text.strip()
    if not key: return bot.send_message(cid, "密钥不能为空")
    StreamManager.add_key(name, key)
    bot.send_message(cid, f"✅ 成功添加推流密钥: `{name}`", parse_mode='Markdown', reply_markup=get_keyboard("stream", stream_process=stream_process))

def start_ffmpeg_stream(url, cid, rtmp_url):
    global stream_process
    if stream_process: stop_stream_process(stream_process)
    bot.send_message(cid, "🚀 启动推流...")
    cmd = ['ffmpeg', '-re', '-i', url, '-c:v', 'libx264', '-preset', 'ultrafast', '-f', 'flv', rtmp_url]
    stream_process = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, preexec_fn=os.setsid)

def stop_stream_process(proc):
    try: os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
    except: pass

# --- Monitor ---
# Monitor is now handled by modules.monitor.Monitor class

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
        bot.infinity_polling(timeout=20, long_polling_timeout=10, allowed_updates=telebot.util.update_types, skip_pending=True)
    except Exception as e:
        print(f"Polling error: {e}")
        time.sleep(15)
