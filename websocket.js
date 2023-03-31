const net = require('net');
const crypto = require('crypto');

class WebSocketServer {
  constructor(port) {
    this.server = net.createServer((socket) => {
      this.handleConnection(socket);
    });
    this.clients = [];
    this.server.listen(port, () => {
      console.log(`WebSocket server started on port ${port}`);
    });
  }

  handleConnection(socket) {
    socket.on('data', (data) => {
      const headers = this.parseHeaders(data);
      if (headers && this.validateHeaders(headers)) {
        this.upgradeSocket(socket, headers);
        this.clients.push(socket);
        console.log('Client connected');

        socket.on('data', (data) => {
          this.handleMessage(socket, data);
        });

        socket.on('close', () => {
          console.log('Client disconnected');
          this.clients = this.clients.filter((client) => client !== socket);
        });
      } else {
        socket.end();
        console.log('Invalid handshake request');
      }
    });
  }

  parseHeaders(data) {
    const headers = data.toString().split('\r\n');
    if (headers.length < 1) {
      return null;
    }
    return headers.reduce((accumulator, header) => {
      const parts = header.split(': ');
      if (parts.length === 2) {
        accumulator[parts[0]] = parts[1];
      }
      return accumulator;
    }, {});
  }

  validateHeaders(headers) {
    return headers['Connection'] && headers['Connection'].toLowerCase() === 'upgrade' &&
           headers['Upgrade'] && headers['Upgrade'].toLowerCase() === 'websocket' &&
           headers['Sec-WebSocket-Key'] && headers['Sec-WebSocket-Version'] && headers['Sec-WebSocket-Version'] === '13';
  }

  upgradeSocket(socket, headers) {
    const secWebSocketKey = headers['Sec-WebSocket-Key'];
    const sha1 = crypto.createHash('sha1');
    sha1.update(secWebSocketKey + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11');
    const secWebSocketAccept = sha1.digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\n` +
                 `Upgrade: websocket\r\n` +
                 `Connection: Upgrade\r\n` +
                 `Sec-WebSocket-Accept: ${secWebSocketAccept}\r\n\r\n`);
  }

  handleMessage(senderSocket, data) {
    const isTextFrame = (data[0] & 0x80) === 0x80;
    if (!isTextFrame) {
      return;
    }

    const payloadLength = data[1] & 0x7f;
    let payloadOffset = 2;

    if (payloadLength === 126) {
      payloadOffset = 4;
    } else if (payloadLength === 127) {
      payloadOffset = 10;
    }

    const payload = data.slice(payloadOffset, payloadOffset + payloadLength).toString();
    console.log(`Received message from client: ${payload}`);

    this.clients.forEach((client) => {
      if (client !== senderSocket) {
        const frame = Buffer.alloc(payloadLength + payloadOffset);
        frame[0] = 0x81;
        frame[1] = payloadLength;
        Buffer.from(payload).copy(frame, payloadOffset);
        client.write(frame);
      }
    });
  }
}

const server = new WebSocketServer(3000);
