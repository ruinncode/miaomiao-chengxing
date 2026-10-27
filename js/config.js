// ============================================================
//  喵喵成行 — easy-to-edit settings
// ============================================================
window.GAME_CONFIG = {
  // Names shown in the game
  player1Name: '黑猫 Ashley',      // black cat (room creator / host)
  player2Name: '白猫 宝贝',     // white cat (the one who joins)

  // ✏️  Personal message on the ending screen — edit me!
  endingTitle: '你们一起回家啦 ❤',
  endingTitleEn: 'You two made it home together ❤',
  endingMessage: '不管隔着多远，有你在，每一关都变简单了。我们一直一起走下去吧 🐾',

  // Physics (pixels / seconds). Levels are designed around these numbers,
  // so change them carefully.
  gameTitle: '喵喵成行',

  physics: {
    gravity: 1400,
    runSpeed: 180,
    jumpVelocity: 500,   // ~89px jump: clears 2 tiles, NOT 3 tiles alone
    maxFall: 720,
  },

  // Online play (PeerJS public cloud signaling + STUN/TURN)
  net: {
    idPrefix: 'catcouple-v1-',
    snapshotHz: 30,
    interpDelayMs: 100,
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'stun:global.stun.twilio.com:3478' },
      // Free public TURN relay (Open Relay Project) – helps on strict networks
      { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
    ],
  },
};
