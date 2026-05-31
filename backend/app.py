import os
from flask import Flask, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

# 导入数据库模块（会自动初始化数据库）
import database

from routes.novel import novel_bp
from routes.provider import provider_bp
from routes.harness import harness_bp

app = Flask(__name__)
CORS(app)

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)

app.register_blueprint(novel_bp, url_prefix='/api/novel')
app.register_blueprint(provider_bp, url_prefix='/api/provider')
app.register_blueprint(harness_bp, url_prefix='/api')

@app.route('/api/health')
def health():
    return {'status': 'ok', 'timestamp': '2026-04-13'}

@app.route('/uploads/<path:filename>')
def serve_upload(filename):
    return send_from_directory(UPLOAD_DIR, filename)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3001))
    host = os.environ.get('HOST', '0.0.0.0')
    app.run(host=host, port=port, debug=True)
