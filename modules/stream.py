import json
import os

KEYS_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'stream_keys.json')

class StreamManager:
    @staticmethod
    def load_keys():
        if not os.path.exists(KEYS_FILE):
            return {}
        try:
            with open(KEYS_FILE, 'r') as f:
                return json.load(f)
        except:
            return {}

    @staticmethod
    def save_keys(keys):
        os.makedirs(os.path.dirname(KEYS_FILE), exist_ok=True)
        with open(KEYS_FILE, 'w') as f:
            json.dump(keys, f, indent=4)

    @staticmethod
    def add_key(name, key):
        keys = StreamManager.load_keys()
        if not key.startswith('rtmp'):
            key = f"rtmps://dc5-1.rtmp.t.me/s/{key}"
        keys[name] = key
        StreamManager.save_keys(keys)

    @staticmethod
    def remove_key(name):
        keys = StreamManager.load_keys()
        if name in keys:
            del keys[name]
            StreamManager.save_keys(keys)
            return True
        return False

    @staticmethod
    def get_key(name):
        keys = StreamManager.load_keys()
        return keys.get(name)
