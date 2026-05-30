# server.py - 简单HTTP服务器用于运行网页版卡牌游戏

import http.server
import socketserver
import webbrowser
import os
import threading
import time

PORT = 8000
DIRECTORY = "."

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        super().end_headers()

def serve():
    os.chdir(DIRECTORY)  # 确保在正确的目录中
    with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
        print(f"服务器启动在端口 {PORT}")
        print(f"访问地址: http://localhost:{PORT}/")
        httpd.serve_forever()

def open_browser():
    time.sleep(2)  # 等待服务器启动
    webbrowser.open_new_tab(f"http://localhost:{PORT}/")

if __name__ == "__main__":
    DIRECTORY = os.path.dirname(os.path.abspath(__file__))  # 设置为当前脚本目录
    print(f"服务器将在目录: {DIRECTORY}")

    print("启动网页版卡牌游戏服务器...")

    # 启动服务器线程
    server_thread = threading.Thread(target=serve)
    server_thread.daemon = True
    server_thread.start()

    # 打开浏览器
    browser_thread = threading.Thread(target=open_browser)
    browser_thread.daemon = True
    browser_thread.start()

    try:
        print("服务器正在运行。按 Ctrl+C 停止服务器。")
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n服务器已停止。")