
const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createServer } = require('http');
require('dotenv').config();

const app = express();
const PORT = process.env.PROXY_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Kalshi WebSocket configuration - use trade API with authentication
const KALSHI_WS_URL = 'wss://api.elections.kalshi.com/trade-api/ws/v2';
const KALSHI_API_KEY = process.env.KALSHI_API_KEY;
const KALSHI_PRIVATE_KEY_PATH = process.env.KALSHI_PRIVATE_KEY_PATH || './private-key-clean.pem';

// Load private key from file
function loadPrivateKeyFromFile(filePath) {
    try {
        const absolutePath = path.resolve(filePath);
        const privateKeyPem = fs.readFileSync(absolutePath, 'utf8');
        return privateKeyPem;
    } catch (error) {
        console.error('Error loading private key:', error);
        return null;
    }
}

// Sign text with private key using standard RSA-PSS padding
function signPssText(privateKeyPem, text) {
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(text);
    sign.end();
    
    const signature = sign.sign({
        key: privateKeyPem,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
    });
    
    return signature.toString('base64');
}

// Create authentication headers for Kalshi WebSocket
function createKalshiHeaders() {
    const timestamp = Date.now().toString();
    const method = 'GET';
    const path = '/trade-api/ws/v2';
    const msgString = timestamp + method + path;
    
    const privateKeyPem = loadPrivateKeyFromFile(KALSHI_PRIVATE_KEY_PATH);
    if (!privateKeyPem) {
        throw new Error('Failed to load private key');
    }
    
    const signature = signPssText(privateKeyPem, msgString);
    
    return {
        'KALSHI-ACCESS-KEY': KALSHI_API_KEY,
        'KALSHI-ACCESS-SIGNATURE': signature,
        'KALSHI-ACCESS-TIMESTAMP': timestamp,
    };
}

// Create HTTP server
const server = createServer(app);

// Create WebSocket server for frontend connections
const wss = new WebSocket.WebSocketServer({ server });

// Store active connections
const connections = new Map();

wss.on('connection', (frontendWs, req) => {
    console.log('Frontend WebSocket connected');
    
    let kalshiWs = null;
    let connectionId = Date.now().toString();
    
    // Store connection
    connections.set(connectionId, {
        frontend: frontendWs,
        kalshi: null
    });
    
    // Handle messages from frontend
    frontendWs.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            console.log('Received from frontend:', data);
            
            // If this is a subscription request, connect to Kalshi
            if (data.cmd === 'subscribe' && !kalshiWs) {
                connectToKalshi(connectionId, data);
            } else if (kalshiWs && kalshiWs.readyState === WebSocket.OPEN) {
                // Forward other messages to Kalshi
                kalshiWs.send(message);
            }
        } catch (error) {
            console.error('Error handling frontend message:', error);
        }
    });
    
    // Handle frontend disconnect
    frontendWs.on('close', () => {
        console.log('Frontend WebSocket disconnected');
        if (kalshiWs) {
            kalshiWs.close();
        }
        connections.delete(connectionId);
    });
    
    // Handle frontend errors
    frontendWs.on('error', (error) => {
        console.error('Frontend WebSocket error:', error);
    });
    
    // Function to connect to Kalshi WebSocket
    function connectToKalshi(connId, subscriptionData) {
        try {
            console.log('Connecting to Kalshi WebSocket...');
            
            // Create authentication headers
            const headers = createKalshiHeaders();
            
            // Connect to Kalshi WebSocket with authentication
            kalshiWs = new WebSocket(KALSHI_WS_URL, { headers });
            
            // Update connection
            const conn = connections.get(connId);
            if (conn) {
                conn.kalshi = kalshiWs;
            }
            
            kalshiWs.on('open', () => {
                console.log('Connected to Kalshi WebSocket');
                
                // Send subscription message to Kalshi
                kalshiWs.send(JSON.stringify(subscriptionData));
            });
            
            kalshiWs.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    console.log('Received from Kalshi:', message);
                    
                    // Forward message to frontend
                    if (frontendWs.readyState === WebSocket.OPEN) {
                        frontendWs.send(data);
                    }
                } catch (error) {
                    console.error('Error parsing Kalshi message:', error);
                }
            });
            
            kalshiWs.on('close', () => {
                console.log('Kalshi WebSocket disconnected');
                if (frontendWs.readyState === WebSocket.OPEN) {
                    frontendWs.close();
                }
            });
            
            kalshiWs.on('error', (error) => {
                console.error('Kalshi WebSocket error:', error);
                if (frontendWs.readyState === WebSocket.OPEN) {
                    frontendWs.send(JSON.stringify({
                        type: 'error',
                        message: 'Kalshi WebSocket error: ' + error.message
                    }));
                }
            });
            
        } catch (error) {
            console.error('Error connecting to Kalshi:', error);
            if (frontendWs.readyState === WebSocket.OPEN) {
                frontendWs.send(JSON.stringify({
                    type: 'error',
                    message: 'Failed to connect to Kalshi: ' + error.message
                }));
            }
        }
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        connections: connections.size,
        timestamp: new Date().toISOString()
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`Kalshi WebSocket proxy server running on port ${PORT}`);
    console.log(`WebSocket endpoint: ws://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down server...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
