// ============================================================
//  Net — PeerJS (WebRTC) wrapper. Host is authoritative.
//  Callbacks: onStatus(text, kind), onConnected(), onDisconnected(), onMessage(msg)
// ============================================================
window.Net = (function () {
  const CFG = window.GAME_CONFIG.net;
  const LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const makeCode = () => Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');

  class Net {
    constructor(cb) {
      this.cb = cb; this.peer = null; this.conn = null; this.role = null; this.code = null;
      this.lastRecv = 0; this.retryTimer = null; this.hbTimer = null; this.rtt = 0; this.closed = false;
    }
    peerOpts() { return { debug: 1, config: { iceServers: CFG.iceServers } }; }

    // ---------- host ----------
    host(preferred, tries = 0) {
      this.role = 'host'; this.code = (preferred && tries < 4) ? preferred : makeCode();
      const peer = this.peer = new Peer(CFG.idPrefix + this.code, this.peerOpts());
      peer.on('open', () => this.cb.onStatus && this.cb.onStatus('room-ready', this.code));
      peer.on('connection', (conn) => {
        if (this.conn && this.conn.open) { try { this.conn.close(); } catch (e) {} }
        this.attach(conn);
      });
      peer.on('disconnected', () => { if (!this.closed) setTimeout(() => { try { if (!peer.destroyed) peer.reconnect(); } catch (e) {} }, 1000); });
      peer.on('error', (err) => {
        if (err.type === 'unavailable-id' && tries < 8) {
          peer.destroy(); setTimeout(() => this.host(preferred, tries + 1), preferred && tries < 4 ? 1500 : 0); return;
        }
        if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error' || err.type === 'socket-closed') {
          this.cb.onStatus && this.cb.onStatus('signal-trouble', err.type); return;
        }
        this.cb.onStatus && this.cb.onStatus('error', err.type || String(err));
      });
      this.startHeartbeat();
    }

    // ---------- guest ----------
    join(code) {
      this.role = 'guest'; this.code = code.toUpperCase();
      const peer = this.peer = new Peer(this.peerOpts());
      peer.on('open', () => this.connectToHost());
      peer.on('disconnected', () => { if (!this.closed) setTimeout(() => { try { if (!peer.destroyed) peer.reconnect(); } catch (e) {} }, 1000); });
      peer.on('error', (err) => {
        if (err.type === 'peer-unavailable') {
          if (this.everConnected) this.scheduleRetry();
          else this.cb.onStatus && this.cb.onStatus('no-room', this.code);
          return;
        }
        if (this.everConnected) { this.scheduleRetry(); return; }
        this.cb.onStatus && this.cb.onStatus('error', err.type || String(err));
      });
      this.startHeartbeat();
    }
    connectToHost() {
      if (this.closed || !this.peer || this.peer.destroyed) return;
      if (this.peer.disconnected) { try { this.peer.reconnect(); } catch (e) {} this.scheduleRetry(); return; }
      const conn = this.peer.connect(CFG.idPrefix + this.code, { reliable: true, serialization: 'json' });
      this.attach(conn);
      // if it doesn't open in time, retry
      setTimeout(() => { if (!conn.open && this.conn === conn) { try { conn.close(); } catch (e) {} this.scheduleRetry(); } }, 8000);
    }
    scheduleRetry() {
      if (this.closed || this.retryTimer) return;
      this.retryTimer = setTimeout(() => { this.retryTimer = null; if (!(this.conn && this.conn.open)) this.connectToHost(); }, 2000);
    }

    // ---------- shared ----------
    attach(conn) {
      this.conn = conn;
      conn.on('open', () => {
        if (this.conn !== conn) return;
        this.everConnected = true; this.lastRecv = performance.now();
        this.cb.onConnected && this.cb.onConnected();
      });
      conn.on('data', (msg) => {
        if (this.conn !== conn) return;
        this.lastRecv = performance.now();
        if (msg && msg.t === 'ping') { this.send({ t: 'pong', s: msg.s }); return; }
        if (msg && msg.t === 'pong') { this.rtt = performance.now() - msg.s; return; }
        this.cb.onMessage && this.cb.onMessage(msg);
      });
      const lost = () => {
        if (this.conn !== conn) return;
        this.conn = null;
        this.cb.onDisconnected && this.cb.onDisconnected();
        if (this.role === 'guest') this.scheduleRetry();
      };
      conn.on('close', lost);
      conn.on('error', lost);
      this._lost = lost;
    }
    startHeartbeat() {
      clearInterval(this.hbTimer);
      this.hbTimer = setInterval(() => {
        if (!this.conn || !this.conn.open) return;
        this.send({ t: 'ping', s: performance.now() });
        if (performance.now() - this.lastRecv > 6000) { // silent for too long
          const c = this.conn; try { c.close(); } catch (e) {}
          if (this.conn === c && this._lost) this._lost();
        }
      }, 1000);
    }
    get connected() { return !!(this.conn && this.conn.open); }
    send(msg) { if (this.conn && this.conn.open) { try { this.conn.send(msg); } catch (e) {} } }
    destroy() {
      this.closed = true; clearInterval(this.hbTimer); clearTimeout(this.retryTimer);
      try { this.conn && this.conn.close(); } catch (e) {}
      try { this.peer && this.peer.destroy(); } catch (e) {}
    }
  }
  return Net;
})();
