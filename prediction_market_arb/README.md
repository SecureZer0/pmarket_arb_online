# Kalshi WebSocket Proxy

This is a Node.js server that acts as a proxy between your frontend and the Kalshi WebSocket API, handling the complex RSA-PSS authentication that browsers cannot perform.

## Setup

1. **Install dependencies:**
   ```bash
   cd kalshi-proxy
   npm install
   ```

2. **Create environment file:**
   ```bash
   cp env.example .env
   ```

3. **Configure your credentials:**
   - Edit `.env` file
   - Set `KALSHI_API_KEY` to your Kalshi API key ID
   - Set `KALSHI_PRIVATE_KEY_PATH` to the path of your private key file

4. **Add your private key:**
   - Place your `private-key.pem` file in the `kalshi-proxy` directory
   - Or update the path in `.env` to point to your key file

5. **Start the proxy server:**
   ```bash
   npm start
   # or for development with auto-restart:
   npm run dev
   ```

## Usage

The proxy server will:
1. Accept WebSocket connections from your frontend on `ws://localhost:3001`
2. Handle Kalshi authentication with RSA-PSS signing
3. Forward messages between your frontend and Kalshi
4. Provide a health check endpoint at `http://localhost:3001/health`

## Frontend Integration

Update your frontend to connect to the proxy instead of directly to Kalshi:

```javascript
// Instead of: wss://api.elections.kalshi.com
const ws = new WebSocket('ws://localhost:3001');
```

The message format remains the same - the proxy just handles the authentication transparently.
