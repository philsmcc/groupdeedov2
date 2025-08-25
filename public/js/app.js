// Global variables
let socket;
let currentLocation = null;
let currentSettings = {
    username: localStorage.getItem('username') || '',
    radius: parseFloat(localStorage.getItem('radius')) || 5,
    channel: localStorage.getItem('channel') || 'general'
};

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    loadSettings();
    getLocation();
});

function initializeApp() {
    // Initialize Socket.io connection
    socket = io();
    
    // Socket event listeners
    socket.on('connect', () => {
        console.log('Connected to server');
        if (currentLocation) {
            updateLocationOnServer();
        }
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
    });
    
    socket.on('newMessage', (message) => {
        addMessageToChat(message);
    });
}

function setupEventListeners() {
    // Message input
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.querySelector('.send-btn');
    
    messageInput.addEventListener('input', () => {
        sendBtn.disabled = messageInput.value.trim().length === 0;
    });
    
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !sendBtn.disabled) {
            sendMessage();
        }
    });
    
    // Settings
    const radiusSlider = document.getElementById('radius');
    const radiusValue = document.getElementById('radiusValue');
    
    radiusSlider.addEventListener('input', () => {
        radiusValue.textContent = radiusSlider.value;
    });
    
    // Touch/click outside settings to close
    document.getElementById('settingsPanel').addEventListener('click', (e) => {
        if (e.target.id === 'settingsPanel') {
            toggleSettings();
        }
    });
}

function loadSettings() {
    // Load saved settings
    document.getElementById('username').value = currentSettings.username;
    document.getElementById('radius').value = currentSettings.radius;
    document.getElementById('channel').value = currentSettings.channel;
    document.getElementById('radiusValue').textContent = currentSettings.radius;
    
    // Update display
    updateSettingsDisplay();
    
    // Load settings from server session
    fetch('/api/settings')
        .then(response => response.json())
        .then(data => {
            if (data.username || data.radius || data.channel) {
                currentSettings = {
                    username: data.username || currentSettings.username,
                    radius: data.radius || currentSettings.radius,
                    channel: data.channel || currentSettings.channel
                };
                
                // Update form
                document.getElementById('username').value = currentSettings.username;
                document.getElementById('radius').value = currentSettings.radius;
                document.getElementById('channel').value = currentSettings.channel;
                document.getElementById('radiusValue').textContent = currentSettings.radius;
                
                updateSettingsDisplay();
            }
        })
        .catch(error => {
            console.error('Error loading settings:', error);
        });
}

function saveSettings() {
    const username = document.getElementById('username').value.trim();
    const radius = parseFloat(document.getElementById('radius').value);
    const channel = document.getElementById('channel').value.trim() || 'general';
    
    if (!username) {
        showStatus('Please enter a display name', 'error');
        return;
    }
    
    currentSettings = { username, radius, channel };
    
    // Save to localStorage
    localStorage.setItem('username', username);
    localStorage.setItem('radius', radius.toString());
    localStorage.setItem('channel', channel);
    
    // Save to server session
    fetch('/api/settings', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(currentSettings)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            updateSettingsDisplay();
            toggleSettings();
            showStatus('Settings saved!');
            
            // Update location on server with new settings
            if (currentLocation) {
                updateLocationOnServer();
                loadMessages(); // Reload messages with new settings
            }
        }
    })
    .catch(error => {
        console.error('Error saving settings:', error);
        showStatus('Error saving settings', 'error');
    });
}

function updateSettingsDisplay() {
    document.getElementById('currentRadius').textContent = currentSettings.radius;
    document.getElementById('currentChannel').textContent = currentSettings.channel;
    
    // Enable send button if username is set
    const sendBtn = document.querySelector('.send-btn');
    const messageInput = document.getElementById('messageInput');
    
    if (currentSettings.username && messageInput.value.trim()) {
        sendBtn.disabled = false;
    } else if (!currentSettings.username) {
        sendBtn.disabled = true;
    }
}

function toggleSettings() {
    const panel = document.getElementById('settingsPanel');
    panel.classList.toggle('active');
}

function getLocation() {
    const locationStatus = document.getElementById('locationStatus');
    
    if (!navigator.geolocation) {
        locationStatus.textContent = 'Geolocation not supported';
        showStatus('Geolocation not supported by your browser', 'error');
        return;
    }
    
    locationStatus.textContent = 'Getting location...';
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            currentLocation = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            };
            
            locationStatus.textContent = `Located: ${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}`;
            
            updateLocationOnServer();
            loadMessages();
            
            // Watch for location changes
            navigator.geolocation.watchPosition(
                (position) => {
                    const newLocation = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    };
                    
                    // Only update if moved significantly (>100 meters)
                    const distance = calculateDistance(
                        currentLocation.latitude, currentLocation.longitude,
                        newLocation.latitude, newLocation.longitude
                    );
                    
                    if (distance > 0.062) { // ~100 meters in miles
                        currentLocation = newLocation;
                        locationStatus.textContent = `Located: ${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}`;
                        updateLocationOnServer();
                        loadMessages();
                    }
                },
                (error) => {
                    console.warn('Location watch error:', error);
                },
                {
                    enableHighAccuracy: false,
                    timeout: 10000,
                    maximumAge: 300000 // 5 minutes
                }
            );
        },
        (error) => {
            console.error('Geolocation error:', error);
            let errorMessage;
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = 'Location access denied. Please enable location access.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = 'Location information unavailable.';
                    break;
                case error.TIMEOUT:
                    errorMessage = 'Location request timed out.';
                    break;
                default:
                    errorMessage = 'An unknown error occurred.';
                    break;
            }
            locationStatus.textContent = errorMessage;
            showStatus(errorMessage, 'error');
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000 // 5 minutes
        }
    );
}

function updateLocationOnServer() {
    if (socket && currentLocation) {
        socket.emit('updateLocation', {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            radius: currentSettings.radius,
            channel: currentSettings.channel
        });
    }
}

function loadMessages() {
    if (!currentLocation) return;
    
    fetch('/api/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            radius: currentSettings.radius,
            channel: currentSettings.channel
        })
    })
    .then(response => response.json())
    .then(data => {
        const container = document.getElementById('messagesContainer');
        
        // Clear existing messages (keep welcome message)
        const messages = container.querySelectorAll('.message');
        messages.forEach(msg => msg.remove());
        
        // Add new messages
        if (data.messages && data.messages.length > 0) {
            data.messages.forEach(message => {
                addMessageToChat(message, false);
            });
            
            // Scroll to bottom
            container.scrollTop = container.scrollHeight;
        }
    })
    .catch(error => {
        console.error('Error loading messages:', error);
        showStatus('Error loading messages', 'error');
    });
}

function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const messageText = messageInput.value.trim();
    
    if (!messageText || !currentLocation || !currentSettings.username) {
        if (!currentSettings.username) {
            showStatus('Please set your display name in settings', 'error');
            toggleSettings();
        }
        return;
    }
    
    const messageData = {
        username: currentSettings.username,
        message: messageText,
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        channel: currentSettings.channel
    };
    
    fetch('/api/message', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            messageInput.value = '';
            document.querySelector('.send-btn').disabled = true;
        } else {
            showStatus('Error sending message', 'error');
        }
    })
    .catch(error => {
        console.error('Error sending message:', error);
        showStatus('Error sending message', 'error');
    });
}

function addMessageToChat(message, animate = true) {
    const container = document.getElementById('messagesContainer');
    const messageElement = document.createElement('div');
    messageElement.className = 'message';
    
    const distance = currentLocation ? 
        calculateDistance(
            currentLocation.latitude, currentLocation.longitude,
            message.latitude, message.longitude
        ) : 0;
    
    const timeStr = new Date(message.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    messageElement.innerHTML = `
        <div class="message-header">
            <span class="message-username">${escapeHtml(message.username)}</span>
            <span class="message-time">${timeStr}</span>
        </div>
        <div class="message-text">${escapeHtml(message.message)}</div>
        <div class="message-distance">${distance.toFixed(1)} miles away</div>
    `;
    
    container.appendChild(messageElement);
    
    // Auto-scroll to bottom
    container.scrollTop = container.scrollHeight;
    
    // Remove old messages to prevent memory issues (keep last 100)
    const messages = container.querySelectorAll('.message');
    if (messages.length > 100) {
        messages[0].remove();
    }
}

function showStatus(message, type = 'success') {
    const statusElement = document.getElementById('statusMessage');
    statusElement.textContent = message;
    statusElement.className = `status-message ${type} show`;
    
    setTimeout(() => {
        statusElement.classList.remove('show');
    }, 3000);
}

// Utility functions
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Service Worker registration for PWA (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('SW registered: ', registration);
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}