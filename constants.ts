import { CommandStep, InstallMethod } from './types';

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
    title: '1. 准备环境 (Termux API)',
    description: '我们需要 Termux:API 来控制 WiFi，以及 Python 来运行机器人。',
    command: 'pkg install python termux-api -y && pip install pyTelegramBotAPI',
    explanation: '注意：你还需要从 F-Droid 或 Play 商店下载并安装 "Termux:API" 应用程序，并授予其所有权限。'
  },
  {
    id: 'bot_token',
    title: '2. 获取 Bot Token',
    description: '在 Telegram 中找到 @BotFather，创建一个新机器人并获取 API Token。',
    command: 'echo "无需命令，请在 Telegram 中操作"',
    explanation: '复制获得的 HTTP API Token，稍后需要在脚本中替换 "YOUR_BOT_TOKEN"。'
  },
  {
    id: 'bot_script',
    title: '3. 创建机器人脚本 (bot.py)',
    description: '创建一个支持自动切换 WiFi 的 Python 脚本。使用 "nano bot.py" 粘贴以下内容。',
    command: `import telebot
import subprocess
import time
import threading
import json

# --- 配置 ---
BOT_TOKEN = '你的_TOKEN_填在这里'

# 预设 WiFi 列表 (SSID: 密码)
# 脚本会自动在断线时尝试连接这些网络
WIFI_CONFIG = {
    'Home_WiFi_5G': 'password123',
    'Office_WiFi': 'password456',
    'Backup_Hotspot': 'password789'
}

bot = telebot.TeleBot(BOT_TOKEN)

def run_command(cmd):
    try:
        return subprocess.getoutput(cmd)
    except Exception as e:
        return str(e)

# --- WiFi 自动管理 ---
def check_wifi_loop():
    while True:
        try:
            # 获取连接状态 (Termux API 返回 JSON)
            info_str = run_command('termux-wifi-connectioninfo')
            try:
                info = json.loads(info_str)
            except:
                info = {}

            # 如果状态不是 COMPLETED，说明断线或正在连接中
            if info.get('supplicant_state') != 'COMPLETED':
                print("⚠️ WiFi 断线，开始尝试备用网络...")
                
                # 遍历配置列表尝试连接
                connected = False
                for ssid, password in WIFI_CONFIG.items():
                    print(f"🔄 尝试连接: {ssid}")
                    run_command(f'termux-wifi-connect -s "{ssid}" -p "{password}"')
                    
                    # 等待连接建立 (15秒)
                    time.sleep(15) 
                    
                    # 再次检查
                    new_info_str = run_command('termux-wifi-connectioninfo')
                    if '"supplicant_state": "COMPLETED"' in new_info_str and ssid in new_info_str:
                        print(f"✅ 成功连接到: {ssid}")
                        connected = True
                        break
                
                if not connected:
                    print("❌ 所有预设 WiFi 连接失败，60秒后重试")
                    time.sleep(60)
            else:
                # 已连接，每30秒检查一次
                time.sleep(30)
                
        except Exception as e:
            print(f"监控出错: {e}")
            time.sleep(30)

# --- Bot 命令 ---
@bot.message_handler(commands=['start'])
def send_welcome(message):
    help_text = (
        "🤖 **Termux 高级管家**\\n\\n"
        "📡 **WiFi 管理**\\n"
        "/status - 查看当前状态\\n"
        "/list_wifi - 查看预设 WiFi 列表\\n"
        "/switch <ssid> - 切换到指定 WiFi\\n"
        "/scan - 扫描附近 WiFi\\n\\n"
        "📂 **Alist 管理**\\n"
        "/alist_start - 启动服务\\n"
        "/alist_stop - 停止服务"
    )
    bot.reply_to(message, help_text, parse_mode='Markdown')

@bot.message_handler(commands=['status'])
def status(message):
    wifi_info = run_command('termux-wifi-connectioninfo')
    try:
        data = json.loads(wifi_info)
        ssid = data.get('ssid', '未知')
        ip = data.get('ip', '未知')
        state = data.get('supplicant_state', '断开')
    except:
        ssid = "解析失败"
        ip = "-"
        state = "未知"

    alist_pid = run_command('pgrep -f alist')
    
    status_text = (
        f"📡 **WiFi 状态**: {state}\\n"
        f"🆔 **SSID**: \`{ssid}\`\\n"
        f"🌐 **IP**: {ip}\\n\\n"
        f"📂 **Alist 进程**: {'🟢 运行中' if alist_pid else '🔴 未运行'}"
    )
    bot.reply_to(message, status_text, parse_mode='Markdown')

@bot.message_handler(commands=['list_wifi'])
def list_wifi(message):
    txt = "📋 **预设 WiFi 列表:**\\n"
    for ssid in WIFI_CONFIG:
        txt += f"- \`{ssid}\`\\n"
    bot.reply_to(message, txt, parse_mode='Markdown')

@bot.message_handler(commands=['switch'])
def switch_wifi(message):
    try:
        parts = message.text.split(maxsplit=1)
        if len(parts) < 2:
            bot.reply_to(message, "用法: /switch <SSID>")
            return
            
        target_ssid = parts[1]
        
        # 允许切换到配置外的 WiFi (需要修改代码逻辑支持参数密码，或者仅限配置内)
        # 这里为了安全和简便，仅限配置内的 WiFi
        if target_ssid in WIFI_CONFIG:
            password = WIFI_CONFIG[target_ssid]
            bot.reply_to(message, f"🔄 正在切换到 \`{target_ssid}\`...", parse_mode='Markdown')
            run_command(f'termux-wifi-connect -s "{target_ssid}" -p "{password}"')
        else:
            bot.reply_to(message, f"❌ \`{target_ssid}\` 不在脚本的预设列表中。请使用 /list_wifi 查看。", parse_mode='Markdown')
    except Exception as e:
        bot.reply_to(message, f"错误: {str(e)}")

@bot.message_handler(commands=['scan'])
def scan_wifi(message):
    bot.reply_to(message, "🔍 正在扫描...")
    res = run_command('termux-wifi-scaninfo')
    try:
        scan_list = json.loads(res)
        msg = "📶 **扫描结果 (前8个):**\\n"
        for net in scan_list[:8]:
            msg += f"- \`{net.get('ssid')}\` ({net.get('frequency_mhz')}MHz)\\n"
        bot.reply_to(message, msg, parse_mode='Markdown')
    except:
        bot.reply_to(message, "解析扫描结果失败，请确保授予了位置权限。")

@bot.message_handler(commands=['alist_start'])
def start_alist(message):
    subprocess.Popen(['./alist', 'server'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    bot.reply_to(message, "🟢 正在启动 Alist...")

@bot.message_handler(commands=['alist_stop'])
def stop_alist(message):
    run_command('pkill -f alist')
    bot.reply_to(message, "🔴 已发送停止命令")

# 启动后台监控线程
t = threading.Thread(target=check_wifi_loop)
t.daemon = True
t.start()

print("Bot 正在运行... (按 Ctrl+C 停止)")
bot.polling()`,
    explanation: '请在 `WIFI_CONFIG` 字典中填入你常用的 WiFi 名称和密码。脚本会自动在断网时尝试连接这些网络。'
  }
];

export const SYSTEM_INSTRUCTION = `你是一个专业的 Termux 和 Linux 助手，专注于帮助用户在 Android 上安装 Alist 和配置自动化脚本。
你的回答必须全部使用中文。
常见问题解答：
- "Permission denied" (权限被拒绝): 需要运行 'chmod +x alist' 或者 'termux-setup-storage'。
- "Port already in use" (端口被占用): Alist 已经在运行了，使用 pkill alist 停止它。
- WiFi 管理问题: 必须安装 Termux:API APP 并在系统设置中授予它定位权限，否则无法扫描或连接 WiFi。
- 脚本报错: 检查缩进，确保已安装 python 和 pyTelegramBotAPI。
- WiFi 无法自动切换: 检查 WIFI_CONFIG 中的密码是否正确，以及是否有位置权限。

保持回答简洁，多用代码块。`;