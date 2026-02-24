from telebot import types
from modules.alist import FileManager, AlistUtils
from modules.utils import NetworkUtils
from modules.config import ALIST_URL

def get_keyboard(menu_type, user_states=None, data=None, chat_id=None, stream_process=None):
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
        
        items = FileManager.list_dir(user_states, chat_id, path)
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
        filename = FileManager.get_item_by_idx(user_states, chat_id, idx) or "Unknown"
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
