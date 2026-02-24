import requests
from modules.config import ALIST_URL, get_alist_token

class FileManager:
    @staticmethod
    def get_current_path(user_states, chat_id):
        if chat_id not in user_states:
            user_states[chat_id] = {'path': '/'}
        return user_states[chat_id]['path']

    @staticmethod
    def set_path(user_states, chat_id, path):
        if chat_id not in user_states:
            user_states[chat_id] = {}
        user_states[chat_id]['path'] = path
        return True

    @staticmethod
    def list_dir(user_states, chat_id, path):
        token = get_alist_token()
        if not token: return "⚠️ 未配置 ALIST_TOKEN。请在控制台运行 'npm start' 并选择选项 6 来自动配置 Token。"
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
                error_msg += "\n\n💡 提示: 您的 Alist Token 已失效 (可能是因为重置了密码)。请在控制台主菜单选择【6】重新获取 Token。"
            return error_msg
        except Exception as e:
            return f"❌ 请求异常: {str(e)}"

    @staticmethod
    def get_item_by_idx(user_states, chat_id, idx):
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
        if not token: return "⚠️ 未配置 ALIST_TOKEN。请在控制台运行 'npm start' 并选择选项 6 来自动配置 Token。"
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
