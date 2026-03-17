# AI service stub — placeholder for future AI endpoints
from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/health')
def health():
    return jsonify({"status": "ok", "service": "ai-service"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
