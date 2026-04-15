import os
from flask import Flask, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

from routes.music import music_bp
from routes.novel import novel_bp
from routes.workflow import workflow_bp
from routes.export import export_bp

app = Flask(__name__)
CORS(app)

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)

app.register_blueprint(music_bp, url_prefix='/api/music')
app.register_blueprint(novel_bp, url_prefix='/api/novel')
app.register_blueprint(workflow_bp, url_prefix='/api/workflows')
app.register_blueprint(export_bp, url_prefix='/api/music/export')

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
