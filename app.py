from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from risk_engine import calculate_risk
from database import insert_data, get_all_data, get_zone_stats
from datetime import datetime

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# Store latest ESP32/ESP8266 readings
esp_readings = {
    "Zone A": {"count": 0, "pressure": 0, "flow": 0, "motion": 0, "last_seen": None},
    "Zone B": {"count": 0, "pressure": 0, "flow": 0, "motion": 0, "last_seen": None},
    "Zone C": {"count": 0, "pressure": 0, "flow": 0, "motion": 0, "last_seen": None}
}

# Default thresholds
thresholds = {"safe": 40, "warning": 75}

# ================== WEB ROUTES ==================
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@app.route('/analytics')
def analytics():
    return render_template('analytics.html')

@app.route('/history')
def history():
    return render_template('history.html')

@app.route('/crowd_dynamics')
def crowd_dynamics():
    return render_template('crowd_dynamics.html')

# ================== API ENDPOINTS ==================

# Manual analysis
@app.route('/api/analyze', methods=['POST'])
def analyze():
    try:
        data = request.json
        zone = data.get('zone', 'Zone A')
        mode = data.get('mode', 'manual')
        
        if mode == 'esp32':
            # Get from ESP storage
            readings = esp_readings.get(zone, {})
            count = readings.get('count', 0)
            pressure = readings.get('pressure', 0)
            flow = readings.get('flow', 0)
            motion = readings.get('motion', 0)
        else:
            # Manual input
            count = int(data.get('count', 0))
            pressure = int(data.get('pressure', 0))
            flow = float(data.get('flow', 0))
            motion = int(data.get('motion', 0))

        safe = int(data.get('safe', thresholds['safe']))
        warning = int(data.get('warning', thresholds['warning']))
        area = float(data.get('area', 50))

        risk_score, status, sop = calculate_risk(
            count, pressure, flow, motion, safe, warning, area
        )

        insert_data(zone, count, pressure, flow, motion, risk_score, status, mode)

        return jsonify({
            'success': True,
            'risk': risk_score,
            'status': status,
            'sop': sop
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

# ESP8266 Data Endpoint (HTTP POST)
@app.route('/api/esp32/data', methods=['POST'])
def esp32_data():
    try:
        data = request.json
        zone = data.get('zone', 'Zone A')
        
        esp_readings[zone] = {
            'count': int(data.get('count', 0)),
            'pressure': int(data.get('pressure', 0)),
            'flow': float(data.get('flow', 0)),
            'motion': int(data.get('motion', 0)),
            'last_seen': datetime.now().strftime('%H:%M:%S')
        }
        
        # Emit real-time update via WebSocket
        socketio.emit('esp_update', {
            'zone': zone,
            'data': esp_readings[zone]
        })
        
        print(f"✅ ESP data received for {zone}: Count={esp_readings[zone]['count']}")
        
        return jsonify({'success': True, 'message': 'ESP data received'})

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

# Get latest ESP data
@app.route('/api/esp32/latest/<zone>', methods=['GET'])
def get_esp32_latest(zone):
    return jsonify({'success': True, 'data': esp_readings.get(zone, {})})

# Get all ESP data
@app.route('/api/esp32/all', methods=['GET'])
def get_all_esp32():
    return jsonify({'success': True, 'data': esp_readings})

# Update thresholds
@app.route('/api/thresholds', methods=['POST'])
def update_thresholds():
    global thresholds
    data = request.json
    thresholds['safe'] = int(data.get('safe', thresholds['safe']))
    thresholds['warning'] = int(data.get('warning', thresholds['warning']))
    return jsonify({'success': True, 'thresholds': thresholds})

# Get history
@app.route('/api/history')
def get_history():
    limit = request.args.get('limit', 100, type=int)
    data = get_all_data(limit)
    return jsonify({'success': True, 'data': data})

# Get stats
@app.route('/api/stats')
def get_stats():
    stats = get_zone_stats()
    return jsonify({'success': True, 'stats': stats})

# WebSocket events
@socketio.on('connect')
def handle_connect():
    print('Client connected')
    emit('connected', {'data': 'Connected to server'})

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({'success': False, 'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'success': False, 'error': 'Internal server error'}), 500

if __name__ == '__main__':
    print("\n" + "="*60)
    print("🚀 ECRIS SERVER STARTING...")
    print("="*60)
    print("📍 Web Interface: http://localhost:5000")
    print("📡 ESP8266 Endpoint: http://YOUR_IP:5000/api/esp32/data")
    print("🔌 WebSocket: ws://YOUR_IP:5000")
    print("="*60 + "\n")
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)