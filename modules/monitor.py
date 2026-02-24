import time
import threading
import psutil
from modules.utils import NetworkUtils
from modules.config import WIFI_CONFIG, ALERT_CPU, ADMIN_ID

class Monitor:
    def __init__(self, bot):
        self.bot = bot
        self.last_alert_time = 0
        self.auto_switch_enabled = True
        self.stop_event = threading.Event()

    def start(self):
        self.thread = threading.Thread(target=self._run)
        self.thread.daemon = True
        self.thread.start()

    def stop(self):
        self.stop_event.set()

    def _run(self):
        while not self.stop_event.is_set():
            time.sleep(10)
            
            # WiFi Auto Switch
            if self.auto_switch_enabled and not NetworkUtils.check_internet():
                for ssid, pwd in WIFI_CONFIG.items():
                    if NetworkUtils.connect_wifi(ssid, pwd):
                        try:
                            if ADMIN_ID != 0:
                                self.bot.send_message(ADMIN_ID, f"🔄 自动切换 WiFi 成功: {ssid}")
                        except: pass
                        break
            
            # CPU Alert
            if time.time() - self.last_alert_time > 300:
                cpu_usage = psutil.cpu_percent()
                if cpu_usage > ALERT_CPU:
                    try:
                        if ADMIN_ID != 0:
                            self.bot.send_message(ADMIN_ID, f"🚨 CPU 报警: {cpu_usage}%")
                    except: pass
                    self.last_alert_time = time.time()
