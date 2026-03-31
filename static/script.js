// WebSocket connection
let socket = null;
let esp32Interval = null;
let currentMode = 'manual';

// Initialize WebSocket connection to Flask
function initWebSocket() {
    // Connect to Flask's SocketIO server
    socket = io();
    
    socket.on('connect', function() {
        console.log('✅ Connected to server');
        showToast('Real-time connection established', 'success');
    });
    
    socket.on('esp_update', function(data) {
        console.log('📡 ESP update received:', data);
        
        // Update ESP32 display if this is the current zone
        const currentZone = document.getElementById('zone').value;
        if (data.zone === currentZone) {
            updateESP32Display(data.data);
            
            // Auto-analyze if in ESP32 mode
            if (currentMode === 'esp32') {
                analyze();
            }
        }
    });
    
    socket.on('disconnect', function() {
        console.log('❌ Disconnected from server');
        showToast('Real-time connection lost', 'warning');
    });
}

// Toggle between Manual and ESP32 mode
function toggleMode() {
    const mode = document.getElementById('mode').value;
    currentMode = mode;
    const manualSection = document.getElementById('manual-section');
    const esp32Section = document.getElementById('esp32-section');
    const testBtn = document.getElementById('test-esp32-btn');

    if (mode === 'esp32') {
        manualSection.style.display = 'none';
        esp32Section.style.display = 'block';
        testBtn.style.display = 'inline-block';
        refreshESP32();
        startESP32Polling();
        showToast('ESP32 Mode activated - Waiting for sensor data', 'success');
    } else {
        manualSection.style.display = 'block';
        esp32Section.style.display = 'none';
        testBtn.style.display = 'none';
        stopESP32Polling();
    }
}

// Start polling for ESP32 data (fallback if WebSocket fails)
function startESP32Polling() {
    stopESP32Polling();
    esp32Interval = setInterval(refreshESP32, 3000);
}

function stopESP32Polling() {
    if (esp32Interval) {
        clearInterval(esp32Interval);
        esp32Interval = null;
    }
}

// Refresh ESP32 data from server
async function refreshESP32() {
    const zone = document.getElementById('zone').value;

    try {
        const response = await fetch(`/api/esp32/latest/${zone}`);
        const data = await response.json();

        if (data.success && data.data) {
            updateESP32Display(data.data);
        }
    } catch (error) {
        console.error('Error refreshing ESP32:', error);
    }
}

// Update ESP32 display with latest data
function updateESP32Display(data) {
    if (!data) return;
    
    document.getElementById('esp32-count').textContent = data.count || 0;
    document.getElementById('esp32-pressure').textContent = (data.pressure || 0) + ' Pa';
    document.getElementById('esp32-flow').textContent = (data.flow || 0) + ' p/m';
    
    document.getElementById('esp32-motion').textContent =
        data.motion == 1 ? 'High / Panic' : 'Normal';

    document.getElementById('esp32-last-seen').textContent =
        data.last_seen ? `Last seen: ${data.last_seen}` : 'Waiting for data...';
    
    // Also update the hidden values for analysis
    if (currentMode === 'esp32') {
        document.getElementById('esp32-count-hidden').value = data.count || 0;
        document.getElementById('esp32-pressure-hidden').value = data.pressure || 0;
        document.getElementById('esp32-flow-hidden').value = data.flow || 0;
        document.getElementById('esp32-motion-hidden').value = data.motion || 0;
    }
}

// Main analyze function
async function analyze() {
    const mode = document.getElementById('mode').value;
    const zone = document.getElementById('zone').value;
    const safe = document.getElementById('safe').value;
    const warning = document.getElementById('warning').value;
    const area = document.getElementById('area').value;

    let requestData = {
        zone: zone,
        mode: mode,
        safe: safe,
        warning: warning,
        area: area
    };

    if (mode === 'manual') {
        requestData.count = document.getElementById('count').value;
        requestData.pressure = document.getElementById('pressure').value;
        requestData.flow = document.getElementById('flow').value;
        requestData.motion = document.getElementById('motion').value;

        if (!requestData.count || !requestData.pressure || !requestData.flow) {
            showToast('Please fill all values', 'warning');
            return;
        }
    } else {
        // ESP32 mode - use the current ESP32 readings
        requestData.count = document.getElementById('esp32-count').textContent;
        requestData.pressure = document.getElementById('esp32-pressure').textContent.replace(' Pa', '');
        requestData.flow = document.getElementById('esp32-flow').textContent.replace(' p/m', '');
        requestData.motion = document.getElementById('esp32-motion').textContent === 'High / Panic' ? 1 : 0;
    }

    // Show loading state
    document.getElementById('status').innerHTML = '<div class="spinner"></div>';
    document.getElementById('risk').innerText = '-';
    document.getElementById('sop').innerText = '-';

    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        });

        const data = await response.json();

        if (data.success) {
            // Update results
            document.getElementById('risk').innerText = data.risk + '%';
            document.getElementById('status').innerText = data.status;
            document.getElementById('sop').innerText = data.sop;

            // Update card colors based on risk
            const riskClass =
                data.risk <= safe ? 'safe' :
                    data.risk <= warning ? 'warning' : 'critical';

            document.getElementById('status-card').className = `result-card ${riskClass}`;
            document.getElementById('risk-card').className = `result-card ${riskClass}`;
            document.getElementById('sop-card').className = `result-card ${riskClass}`;

            // Update crowd dynamics
            updateCrowdDynamics(data, requestData);

            showToast('Analysis complete', 'success');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error analyzing data', 'error');
    }
}

// Update crowd dynamics section
function updateCrowdDynamics(data, requestData) {
    let count = parseFloat(requestData.count) || 0;
    let flow = parseFloat(requestData.flow) || 0;
    let area = parseFloat(document.getElementById('area').value) || 50;

    // Density calculation
    let density = '-';
    if (area > 0 && count > 0) {
        density = (count / area).toFixed(2) + ' p/m²';
    }
    document.getElementById('density').innerText = density;

    // Flow trend
    let flowTrend = 'Stable';
    if (flow > 20) flowTrend = 'High';
    else if (flow < 5) flowTrend = 'Low';
    
    // Find flow trend element (may have different ID in your HTML)
    const flowTrendEl = document.getElementById('flowTrend');
    if (flowTrendEl) flowTrendEl.innerText = flowTrend;

    // Zone load
    let zoneLoad = 'Low';
    if (data.risk > 75) zoneLoad = 'High';
    else if (data.risk > 40) zoneLoad = 'Moderate';
    
    const zoneLoadEl = document.getElementById('zoneLoad');
    if (zoneLoadEl) zoneLoadEl.innerText = zoneLoad;
}

// Reset inputs to defaults
function resetInputs() {
    document.getElementById('count').value = '82';
    document.getElementById('pressure').value = '1200';
    document.getElementById('flow').value = '60';
    document.getElementById('motion').value = '0';
    document.getElementById('area').value = '50';
    document.getElementById('safe').value = '40';
    document.getElementById('warning').value = '75';

    document.getElementById('status').innerText = '-';
    document.getElementById('risk').innerText = '-';
    document.getElementById('sop').innerText = '-';
    
    document.getElementById('density').innerText = '-';
    
    const flowTrendEl = document.getElementById('flowTrend');
    if (flowTrendEl) flowTrendEl.innerText = 'Stable';
    
    const zoneLoadEl = document.getElementById('zoneLoad');
    if (zoneLoadEl) zoneLoadEl.innerText = 'Low';

    document.getElementById('status-card').className = 'result-card';
    document.getElementById('risk-card').className = 'result-card';
    document.getElementById('sop-card').className = 'result-card';

    showToast('Reset to defaults', 'success');
}

// Test ESP32 with simulated data
async function testESP32() {
    const zone = document.getElementById('zone').value;

    const testData = {
        zone: zone,
        count: Math.floor(Math.random() * 50) + 50,
        pressure: Math.floor(Math.random() * 500) + 800,
        flow: Math.floor(Math.random() * 120),
        motion: Math.random() > 0.5 ? 1 : 0
    };

    try {
        const response = await fetch('/api/esp32/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testData)
        });

        const data = await response.json();

        if (data.success) {
            showToast('Test data sent', 'success');
            refreshESP32();
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error sending test data', 'error');
    }
}

// Toast notification function
function showToast(message, type = 'success') {
    // Remove existing toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon =
        type === 'success' ? 'check-circle' :
            type === 'warning' ? 'exclamation-triangle' : 'exclamation-circle';

    toast.innerHTML = `<i class="fas fa-${icon}"></i> ${message}`;

    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
}

// Auto-refresh ESP32 when zone changes
document.getElementById('zone').addEventListener('change', function() {
    if (document.getElementById('mode').value === 'esp32') {
        refreshESP32();
    }
});

// Initialize everything when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Dashboard initializing...');
    
    // Initialize WebSocket
    initWebSocket();
    
    // Set default values
    resetInputs();
    
    // Check URL for demo mode
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('startDemo') === 'true') {
        setTimeout(() => {
            document.getElementById('mode').value = 'esp32';
            toggleMode();
            testESP32();
        }, 1000);
    }
    
    // Add hidden inputs for ESP32 mode
    const esp32Section = document.getElementById('esp32-section');
    if (esp32Section) {
        // Create hidden inputs to store ESP32 values for analysis
        const hiddenInputs = `
            <input type="hidden" id="esp32-count-hidden" value="0">
            <input type="hidden" id="esp32-pressure-hidden" value="0">
            <input type="hidden" id="esp32-flow-hidden" value="0">
            <input type="hidden" id="esp32-motion-hidden" value="0">
        `;
        esp32Section.insertAdjacentHTML('beforeend', hiddenInputs);
    }
});