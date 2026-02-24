import os
import requests
from telebot import apihelper

# --- 🔧 加载环境变量 ---
def load_env():
    try:
        env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
        if not os.path.exists(env_path):
            # Fallback to current dir if not found in parent
            env_path = '.env'
            
        with open(env_path, 'r') as f:
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

# --- ⚙️ 全局配置 ---
TG_RTMP_URL = os.environ.get('RTMP_URL', '')
ALIST_URL = 'http://127.0.0.1:5244'

def get_alist_token():
    load_env() # Reload env to get the latest token if updated
    return os.environ.get('ALIST_TOKEN', '')

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
    print("❌ 自动检测代理失败。")

auto_setup_proxy()

WIFI_CONFIG = {}
PING_TARGET = '223.5.5.5' 
ALERT_CPU = 90
ALERT_MEM = 90
