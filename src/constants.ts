import { CommandStep, InstallMethod } from './types';

// 获取通过 setup.sh 注入的环境变量 (CLI 模式下从 process.env 读取)
// 注意：main.ts 会负责加载 .env 文件到 process.env
const ENV_BOT_TOKEN = process.env.BOT_TOKEN || '你的_BOT_TOKEN';
const ENV_ADMIN_ID = process.env.ADMIN_ID || '0';

export const INSTALL_STEPS: Record<InstallMethod, CommandStep[]> = {
  [InstallMethod.BINARY]: [
    {
      id: 'update',
      title: '更新 Termux',
      description: '首先，确保你的软件包列表和已安装的程序是最新的。',
      command: 'pkg update && pkg upgrade -y',
    },
    {
      id: 'install',
      title: '安装 Alist',
      description: 'Termux 官方仓库已包含 Alist，直接安装即可。',
      command: 'pkg install alist -y',
      explanation: '这会自动安装最新版本的 Alist 并配置好环境。'
    },
    {
      id: 'run',
      title: '启动服务器',
      description: '启动 Alist 服务器。',
      command: 'alist server',
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
    command: 'alist admin set 123456',
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

export const PM2_STEPS: CommandStep[] = [
  {
    id: 'pm2_install',
    title: '1. 安装 PM2',
    description: 'PM2 是一个守护进程管理器，可以帮你自动在后台运行程序，并在崩溃时自动重启。',
    command: 'npm install pm2 -g',
    explanation: '全局安装 PM2。'
  },
  {
    id: 'pm2_alist',
    title: '2. 使用 PM2 启动 Alist',
    description: '将 Alist 加入 PM2 管理。',
    command: 'pm2 start alist --name alist -- server',
    explanation: '这会启动 Alist 并命名为 "alist"。如果之前手动运行了 Alist，请先用 Ctrl+C 停止它。'
  },
  {
    id: 'pm2_bot',
    title: '3. 使用 PM2 启动 Bot',
    description: '将 Telegram Bot 加入 PM2 管理。',
    command: 'pm2 start python --name bot -- bot.py',
    explanation: '这会启动 Bot 并命名为 "bot"。确保你已经配置好了 bot.py。'
  },
  {
    id: 'pm2_save',
    title: '4. 保存当前进程',
    description: '保存当前的运行列表，以便下次恢复。',
    command: 'pm2 save',
    explanation: '这会将当前运行的 alist 和 bot 保存到 PM2 的转储文件中。'
  },
  {
    id: 'pm2_startup',
    title: '5. 设置开机自启 (Termux)',
    description: '在 Termux 中，我们需要通过 .bashrc 来实现自启。',
    command: 'echo "pm2 resurrect" >> ~/.bashrc',
    explanation: '这行命令会将 "pm2 resurrect" 添加到你的 shell 配置文件中。每次打开 Termux 时，它都会自动恢复之前保存的进程。'
  },
  {
    id: 'pm2_commands',
    title: '6. 常用 PM2 命令',
    description: '一些管理进程的常用命令。',
    command: 'pm2 list (查看列表) | pm2 logs (查看日志) | pm2 stop all (停止所有)',
    explanation: '记住这些命令以便日后维护。'
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