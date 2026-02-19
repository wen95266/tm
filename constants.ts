import { CommandStep, InstallMethod } from './types';

// 获取通过 setup.sh 注入的环境变量 (CLI 模式下从 process.env 读取)
// 注意：main.ts 会负责加载 .env 文件到 process.env
const ENV_BOT_TOKEN = process.env.VITE_BOT_TOKEN || '你的_BOT_TOKEN';
const ENV_ADMIN_ID = process.env.VITE_ADMIN_ID || '0';

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
    title: '1. 准备环境',
    description: '安装 Python、FFmpeg (推流工具) 和 Termux API (WiFi 控制)。',
    command: 'pkg install python termux-api ffmpeg -y && pip install pyTelegramBotAPI',
    explanation: 'FFmpeg 是直播的核心。Termux:API 需要你在安卓系统设置中授予它"位置信息"权限才能扫描 WiFi。'
  },
  {
    id: 'bot_check',
    title: '2. 核对信息',
    description: '以下是自动读取的配置信息。如果为空，请重新运行 setup.sh 配置。',
    command: `echo "Token: ${ENV_BOT_TOKEN}"\necho "Admin: ${ENV_ADMIN_ID}"`,
    explanation: 'Admin ID 用于防止陌生人控制你的机器人。'
  },
  {
    id: 'bot_script',
    title: '3. 生成 bot.py',
    description: '复制下方命令并粘贴到 Termux。它会使用 cat 命令自动创建文件。',
    command: `cat << 'EOF' > bot.py
import telebot
import subprocess
import time
import threading
import json
import shlex

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
        return subprocess.getoutput(cmd)
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
        if stream_process and stream_process.poll() is None:
            stream_process.terminate()
            time.sleep(1)

        bot.reply_to(message, "🚀 正在启动 FFmpeg 推流...")

        # FFmpeg 参数优化: 
        # -re (实时读取), ultrafast (低延迟编码), zerolatency
        cmd = [
            'ffmpeg', '-re', '-i', video_url,
            '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency',
            '-b:v', '2500k', '-maxrate', '3000k', '-bufsize', '6000k',
            '-r', '30', '-g', '60',
            '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
            '-f', 'flv', TG_RTMP_URL
        ]

        stream_process = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        bot.reply_to(message, "✅ 推流已在后台运行！")
        
    except Exception as e:
        bot.reply_to(message, f"❌ 启动失败: {e}")

@bot.message_handler(commands=['stop_stream'])
def stop_stream_cmd(message):
    if not is_authorized(message): return
    global stream_process
    if stream_process and stream_process.poll() is None:
        stream_process.terminate()
        stream_process = None
        bot.reply_to(message, "⏹ 直播推流已停止")
    else:
        bot.reply_to(message, "⚠️ 当前无正在进行的推流")

# --- 📡 WiFi 监控 ---
def check_wifi_loop():
    while True:
        try:
            info_str = run_command('termux-wifi-connectioninfo')
            info = json.loads(info_str) if info_str else {}
            
            if info.get('supplicant_state') != 'COMPLETED':
                print("⚠️ WiFi 断线，正在尝试备用网络...")
                for ssid, pwd in WIFI_CONFIG.items():
                    run_command(f'termux-wifi-connect -s "{ssid}" -p "{pwd}"')
                    time.sleep(12)
                    if 'COMPLETED' in run_command('termux-wifi-connectioninfo'):
                        print(f"✅ 已连接到: {ssid}")
                        break
            time.sleep(20)
        except: time.sleep(20)

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
    wifi = json.loads(run_command('termux-wifi-connectioninfo') or '{}').get('ssid', '未知')
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
        else:
            bot.reply_to(message, "❌ 未知 SSID (请先在脚本 WIFI_CONFIG 中添加)")
    except:
        bot.reply_to(message, "用法: /switch <ssid>")

# 启动后台线程
t = threading.Thread(target=check_wifi_loop)
t.daemon = True
t.start()

print("Bot is running...")
bot.polling()
EOF`,
    explanation: '使用 cat 命令可以避免 nano 粘贴时的格式混乱。'
  },
  {
      id: 'bot_edit',
      title: '4. 填写配置',
      description: '关键步骤：你需要填入真实的 WiFi 密码和推流地址。',
      command: 'nano bot.py',
      explanation: '使用箭头键找到 WIFI_CONFIG 和 TG_RTMP_URL。修改完成后，按 Ctrl+X (音量减 + x)，然后按 Y 保存。'
  },
  {
      id: 'bot_run',
      title: '5. 启动机器人',
      description: '一切就绪！运行机器人。',
      command: 'python bot.py',
      explanation: '看到 "Bot is running..." 即表示成功。你可以随时在 Telegram 给机器人发送 /start。'
  }
];

export const SYSTEM_INSTRUCTION = `你是一个专业的 Termux 和 Linux 专家，也是 Alist 和 FFmpeg 的高级用户。
你的目标是帮助用户解决在 Android Termux 环境下运行 Alist、配置 Telegram 机器人以及进行 FFmpeg 直播推流时遇到的问题。

关键知识点库：
1. **Alist**: 启动命令 './alist server', 默认端口 5244, 配置文件在 'data/config.json'.
2. **Termux**: 安装包使用 'pkg install', 访问存储需 'termux-setup-storage'.
3. **FFmpeg 推流**:
   - 命令结构: ffmpeg -re -i <输入> -c:v libx264 -preset ultrafast -f flv <RTMP地址>
   - 常见报错 "Connection refused": 检查 RTMP 地址是否正确，网络是否通畅。
   - "403 Forbidden": 直链过期或有防盗链，尝试更新 Alist 直链。
4. **Python Bot**:
   - 库: pyTelegramBotAPI
   - 报错 "ImportError": 运行 'pip install pyTelegramBotAPI'.
   - 报错 "Address already in use": 旧的 bot 进程未关闭，使用 'pkill -f bot.py' 或重启 Termux.
5. **WiFi 控制**: 必须安装 "Termux:API" app 并授予位置权限。命令 'termux-wifi-connectioninfo'。

回答风格要求：
- 使用中文。
- 简洁明了，直接给出解决方案或命令。
- 如果用户遇到报错，优先分析报错原因。
- 代码块使用 Markdown 格式。`;