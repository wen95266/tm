import subprocess
import time
import datetime
import psutil
import json
import requests
from modules.config import PING_TARGET, start_time if 'start_time' in globals() else time.time()

# Note: start_time will be handled in bot.py and passed or imported
# For now, let's define a way to get it
START_TIME = time.time()

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
    def get_status_msg(start_time):
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
