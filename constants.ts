import { CommandStep, InstallMethod } from './types';

// Fix: Cast import.meta to any to avoid "Property 'env' does not exist on type 'ImportMeta'" error when types are missing.
// 获取通过 setup.sh 注入的环境变量
const ENV_BOT_TOKEN = (import.meta as any).env.VITE_BOT_TOKEN || '你的_BOT_TOKEN';
// Fix: Cast import.meta to any to avoid "Property 'env' does not exist on type 'ImportMeta'" error when types are missing.
// 如果没有设置 ID，默认为 0 (可以在代码中处理为不限制或提示设置)
const ENV_ADMIN_ID = (import.meta as any).env.VITE_ADMIN_ID || '0';

export const INSTALL_STEPS: Record<InstallMethod, CommandStep[]> = {
  [InstallMethod.BINARY]: [
    {
      id: 'update',
      title: '更新 Termux',
      description: '首先，确保你的软件包列表和已安装的程序是最新的，以避免冲突。',
      command: 'pkg update && pkg upgrade -y',
      explanation: '这将更新包存储库列表并升级已安装的软件。'
    },
    {
      id: 'deps',
      title: '安装依赖',
      description: '我们需要 wget 来下载文件，tar 来解压文件。',
      command: 'pkg install wget tar -y',
    },
    {
      id: 'download',
      title: '下载 Alist (ARM64)',
      description: '下载适用于 Android ARM64 架构（大多数现代手机的标准）的最新二进制文件。',
      command: 'wget https://github.com/alist-org/alist/releases/latest/download/alist-linux-android-arm64.tar.gz',
      explanation: '从官方 GitHub 仓库获取最新的压缩可执行文件。'
    },
    {
      id: 'extract',
      title: '解压文件',
      description: '解压下载的压缩包。',
      command: 'tar -zxvf alist-linux-android-arm64.tar.gz',
    },
    {
      id: 'permission',
      title: '授予执行权限',
      description: '使二进制文件可执行。',
      command: 'chmod +x alist',
    },
    {
      id: 'run',
      title: '启动服务器',
      description: '启动 Alist 服务器。',
      command: './alist server',
      explanation: '这将启动服务器。你应该能看到日志显示服务器正在 5244 端口运行。'
    }
  ],
  [InstallMethod.SCRIPT]: [
    {
      id: 'update_script',
      title: '更新系统',
      description: '确保系统已准备就绪。',
      command: 'pkg update && pkg upgrade -y',
    },
    {
      id: 'install_script',
      title: '运行安装脚本',
      description: '使用官方的一键脚本（在某些 Termux 环境中可能需要 root，但值得一试）。',
      command: 'curl -fsSL "https://alist.nn.ci/v3.sh" | bash -s install',
    }
  ]
};

export const POST_INSTALL_STEPS: CommandStep[] = [
  {
    id: 'password',
    title: '设置管理员密码',
    description: '打开一个新会话（从 Termux 左边缘向右滑 -> New Session），运行此命令设置密码。',
    command: './alist admin set 123456',
    explanation: '将 "123456" 替换为你想要的密码。不要在运行服务器的同一个终端窗口中输入此命令。'
  },
  {
    id: 'access',
    title: '访问 Alist',
    description: '打开你的浏览器。',
    command: 'http://127.0.0.1:5244',
    explanation: '将此 URL 复制到 Chrome 或其他浏览器中。'
  }
];

export const BOT_GUIDE_STEPS: CommandStep[] = [
  {
    id: 'bot_prep',
    title: '1. 准备环境 (API & FFmpeg)',
    description: '安装 Python、FFmpeg (用于推流) 和 Termux API (用于 WiFi)。',
    command: 'pkg install python termux-api ffmpeg -y && pip install pyTelegramBotAPI',
    explanation: 'FFmpeg 是直播推流的核心工具。请务必安装 Termux:API 安卓应用并授予权限。'
  },
  {
    id: 'bot_token',
    title: '2. 确认配置信息',
    description: '以下信息已根据你在安装时的输入自动生成。如果之前跳过了配置，请手动修改脚本。',
    command: `Token: ${ENV_BOT_TOKEN}\nAdmin ID: ${ENV_ADMIN_ID === '0' ? '未设置 (请在 Telegram 通过 @userinfobot 获取)' : ENV_ADMIN_ID}`,
    explanation: 'Admin ID 用于权限验证，防止陌生人控制你的手机。'
  },
  {
    id: 'bot_script',
    title: '3. 创建全能机器人脚本',
    description: '此脚本集成了权限验证、Alist 管理、WiFi 自动切换和 FFmpeg 直播推流功能。',
    command: `import telebot
import subprocess
import time
import threading
import json
import shlex

# --- 🚀 配置区域 ---
BOT_TOKEN = '${ENV_BOT_TOKEN}'
ADMIN_ID = ${ENV_ADMIN_ID}  # 0 代表未设置，建议填入数字 ID

# 直播推流地址 (格式: rtmp://服务器地址/密钥)
TG_RTMP_URL = '你的_TELEGRAM_RTMP_URL'

# 预设 WiFi 列表 (SSID: 密码)
WIFI_CONFIG = {
    'Home_WiFi': 'password123',
    'Office_WiFi': 'password456'
}

bot = telebot.TeleBot(BOT_TOKEN)
stream_process = None

def run_command(cmd):
    try:
        return subprocess.getoutput(cmd)
    except Exception as e:
        return str(e)

# --- 🔒 权限验证 ---
def is_authorized(message):
    if ADMIN_ID == 0:
        return True # 如果未设置 ID，则允许所有人 (不安全)
    return message.from_user.id == ADMIN_ID

# --- 📺 直播推流功能 ---
@bot.message_handler(commands=['stream'])
def start_stream(message):
    if not is_authorized(message): return
    global stream_process
    try:
        parts = message.text.split(maxsplit=1)
        if len(parts) < 2:
            bot.reply_to(message, "用法: /stream <视频直链URL>\\n请从 Alist 复制文件的下载直链。")
            return

        video_url = parts[1]
        
        if stream_process and stream_process.poll() is None:
            stream_process.terminate()
            time.sleep(1)

        bot.reply_to(message, "🚀 正在启动 FFmpeg 推流...\\n目标: Telegram 直播间")

        cmd = [
            'ffmpeg', '-re', '-i', video_url,
            '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', '3000k',
            '-maxrate', '3000k', '-bufsize', '6000k',
            '-pix_fmt', 'yuv420p', '-g', '50',
            '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
            '-f', 'flv', TG_RTMP_URL
        ]

        stream_process = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        bot.reply_to(message, "✅ 推流进程已在后台运行！")
        
    except Exception as e:
        bot.reply_to(message, f"❌ 启动失败: {e}")

@bot.message_handler(commands=['stop_stream'])
def stop_stream_cmd(message):
    if not is_authorized(message): return
    global stream_process
    if stream_process and stream_process.poll() is None:
        stream_process.terminate()
        stream_process = None
        bot.reply_to(message, "⏹ 直播推流已停止。")
    else:
        bot.reply_to(message, "当前没有正在进行的直播任务。")

# --- 📡 WiFi 自动管理 ---
def check_wifi_loop():
    while True:
        try:
            info_str = run_command('termux-wifi-connectioninfo')
            try: info = json.loads(info_str)
            except: info = {}

            if info.get('supplicant_state') != 'COMPLETED':
                print("⚠️ WiFi 断线，尝试重连...")
                for ssid, password in WIFI_CONFIG.items():
                    run_command(f'termux-wifi-connect -s "{ssid}" -p "{password}"')
                    time.sleep(15)
                    new_info = run_command('termux-wifi-connectioninfo')
                    if '"supplicant_state": "COMPLETED"' in new_info and ssid in new_info:
                        print(f"✅ 已重连: {ssid}")
                        break
            time.sleep(30)
        except: time.sleep(30)

# --- 🤖 基础命令 ---
@bot.message_handler(commands=['start'])
def send_welcome(message):
    if not is_authorized(message): 
        bot.reply_to(message, "🚫 你没有权限使用此机器人。")
        return
        
    help_text = (
        "🎬 **Termux 全能管家**\\n"
        f"当前管理员 ID: {ADMIN_ID}\\n\\n"
        "📺 **直播**\\n/stream <URL> - 推流\\n/stop_stream - 停止\\n\\n"
        "📡 **系统**\\n/status - 状态\\n/switch <ssid> - 切 WiFi\\n/alist_start - 启动服务"
    )
    bot.reply_to(message, help_text, parse_mode='Markdown')

@bot.message_handler(commands=['status'])
def status(message):
    if not is_authorized(message): return
    # 检查 FFmpeg
    ffmpeg_status = "🟢 推流中" if stream_process and stream_process.poll() is None else "🔴以此停止"
    # WiFi 信息
    wifi = run_command('termux-wifi-connectioninfo')
    try: wifi_ssid = json.loads(wifi).get('ssid', '未知')
    except: wifi_ssid = "获取失败"
    
    bot.reply_to(message, f"📡 WiFi: {wifi_ssid}\\n🎬 直播状态: {ffmpeg_status}")

@bot.message_handler(commands=['alist_start'])
def start_alist(message):
    if not is_authorized(message): return
    subprocess.Popen(['./alist', 'server'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    bot.reply_to(message, "✅ Alist 启动指令已发送")

# 启动线程
t = threading.Thread(target=check_wifi_loop)
t.daemon = True
t.start()

print("Bot 运行中...")
bot.polling()`,
    explanation: '脚本顶部的 BOT_TOKEN 和 ADMIN_ID 已根据你在安装时的输入自动填充。请记得将 RTMP_URL 替换为你的直播推流地址。'
  }
];

export const SYSTEM_INSTRUCTION = `你是一个专业的 Termux 和 Linux 助手，专注于帮助用户在 Android 上安装 Alist 和配置自动化脚本。
你的回答必须全部使用中文。
常见问题解答：
- "Permission denied": 需要运行 'chmod +x alist' 或者 'termux-setup-storage'。
- 直播推流失败: 检查 RTMP 地址是否正确，确保已安装 ffmpeg (pkg install ffmpeg)，检查网络上行带宽。
- 获取 RTMP 地址: 在 Telegram 群组/频道开始视频聊天 -> 菜单 -> 开始直播 -> 复制推流密钥。
- 机器人没反应: 检查 ADMIN_ID 是否设置正确，使用 @userinfobot 获取你的数字 ID。
- 端口被占用: 使用 pkill alist 停止旧进程。

保持回答简洁，多用代码块。`;