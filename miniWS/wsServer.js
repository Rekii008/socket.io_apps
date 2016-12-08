let net = require('net');
let crypto = require('crypto');

let encode = (msg, mask = false) => {
    msg.length < 126; //must le 126, payload length 7bit
    let packed = Buffer.alloc(msg.length + 2);
    packed.writeUInt8(0x81, 0);
    if (mask == false) {
        packed.writeUInt8(msg.length, 1);
        for (let i = 0; i < msg.length; i++) {
            packed.writeUInt8(msg.charCodeAt(i), 2 + i);
        }
    } else {

    }
    return packed;
};

let decode = (data) => {
    let opcode = data.readInt8(0);
    opcode == 0x81;  //must be 0x81, text frame
    let len = data.readInt8(1);
    let bMask = len & 0x80;
    let length = len & 0x7F;
    let mask;
    let payload;
    if (bMask) {
        mask = data.slice(2, 6); //4B
        payload = data.slice(6, 6 + length);
        for (let i = 0; i < payload.length; i++) {
            // console.log('%s -- %s ', payload[i].toString(16), mask[i % 4].toString(16));
            payload[i] ^= mask[i % 4];
        }
    } else {
        payload = data.slice(2, 2 + length - 1);
    }
    return payload.toString();
};

let encodeClose = (reason) => {
    if (reason) {
        let packed = Buffer.alloc(reason.length + 4);
        packed.writeUInt8(0x88, 0);
        packed.writeUInt8(reason.length + 2, 1);
        packed.writeUInt16BE(0x1001, 2);
        for (let i = 0; i < reason.length; i++) {
            packed.writeUInt8(reason.charCodeAt(i), i + 4);
        }
        return packed;
    } else {
        let packed = Buffer.alloc(1);
        packed.writeUInt8(0x88, 0);
        return packed;
    }
};

let decodeClose = (data) => {
    if (data.length > 1) {
        let bMask = data[1] & 0x80;
        let len = data[1] & 0x7F;
        let payload;
        if (len > 0) {
            if (bMask > 0) {
                let mask = data.slice(2, 6); //4B
                payload = data.slice(6, 6 + len);
                for (let i = 0; i < payload.length; i++) {
                    // console.log('%s -- %s ', payload[i].toString(16), mask[i % 4].toString(16));
                    payload[i] ^= mask[i % 4];
                }
            } else {
                payload = data.slice(2, 2 + len);
            }

            let statusCode = payload.slice(0, 2);
            let reason = payload.slice(2, payload.length);
            return {status: statusCode, reason: reason.toString()};
        }
    }
    return {};
};

net.createServer((socket)=> {
    console.log('connected.');
    socket.on('data', (data) => {
        // console.log('data: ', data);
        if (data.includes('Upgrade')) {
            const strData = data.toString();
            const vecData = strData.split('\r\n');
            let secKey;
            for (let i = 0; i < vecData.length; i++) {
                if (vecData[i].startsWith('Sec-WebSocket-Key:')) {
                    secKey = vecData[i].split(': ')[1];
                }
            }
            let shasum = crypto.createHash('sha1');
            shasum.update(secKey + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11');
            let expectedServerKey = shasum.digest('base64');
            const buf = Buffer.from('HTTP/1.1 101 Switching Protocols\t\n' +
                'Upgrade: websocket\r\n' +
                'Connection: Upgrade\r\n' +
                'Sec-WebSocket-Accept: ' + expectedServerKey + '\r\n\r\n');
            socket.write(buf);
            socket.wsStatus = 'connected';
        } else if (data[0] == 0x88) {
            let closeFrame = decodeClose(data);
            console.log('closed. ');
            if (closeFrame.status) {
                console.log('status: ', closeFrame.status, ', reson: ', closeFrame.reason);
            }
            socket.write(encodeClose('you close first'));
            if (!socket.destroyed) {
                socket.destroy();
            }
        } else {
            let msg = decode(data);
            console.log('rec: ' + msg);
            socket.write(encode(msg + ' too !'));
            // socket.write(encodeClose('I am going away'));
        }
    });
    socket.on('error', (e) => {
        console.log('error: ', e);
    });
}).listen(8080);