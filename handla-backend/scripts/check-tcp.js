#!/usr/bin/env node
'use strict';

const net = require('node:net');

function checkTcp({ host, port, timeoutMs = 2000 } = {}) {
  return new Promise((resolve) => {
    const parsedPort = Number(port);
    const parsedTimeout = Number(timeoutMs);

    if (
      !host ||
      typeof host !== 'string' ||
      host.trim().length === 0 ||
      !Number.isInteger(parsedPort) ||
      parsedPort < 1 ||
      parsedPort > 65535 ||
      !Number.isFinite(parsedTimeout) ||
      parsedTimeout <= 0
    ) {
      return resolve({ success: false, error: 'INVALID_ARGUMENTS' });
    }

    let settled = false;
    let timer = null;
    let socket = null;

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (socket) {
        socket.removeAllListeners();
        socket.destroy();
        socket = null;
      }
    };

    const finish = (result) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    timer = setTimeout(() => {
      finish({ success: false, error: 'TIMEOUT' });
    }, parsedTimeout);

    try {
      socket = net.createConnection({ host: host.trim(), port: parsedPort });
    } catch (err) {
      return finish({ success: false, error: err.code || err.message || 'CREATE_CONNECTION_FAILED' });
    }

    socket.once('connect', () => {
      finish({ success: true });
    });

    socket.once('timeout', () => {
      finish({ success: false, error: 'TIMEOUT' });
    });

    socket.once('error', (err) => {
      finish({ success: false, error: err.code || err.message || 'SOCKET_ERROR' });
    });
  });
}

if (require.main === module) {
  const [,, host, port, timeoutMs] = process.argv;
  checkTcp({ host, port, timeoutMs })
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(() => {
      process.exit(1);
    });
}

module.exports = { checkTcp };
