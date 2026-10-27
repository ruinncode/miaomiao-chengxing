// ============================================================
//  喵喵成行 — easy-to-edit settings
// ============================================================

// ✏️  The two cats' names — change them here and they update everywhere
//     (name tags above the cats, lobby, level clear, scoreboard, winner screen…)
window.NAMES = {
  p1: 'jsq',   // black cat (room creator / host, local: WASD)
  p2: 'yyf',   // brown tabby with a yellow bell collar (the one who joins, local: arrow keys)
};

window.GAME_CONFIG = {
  names: window.NAMES,

  // ✏️  Personal message on the ending screen — edit me!
  //     {p1} / {p2} are replaced with the names above.
  endingTitle: '{p1} 和 {p2} 一起回家啦 ❤',
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
    springVelocity: 760,  // spring '^'
    launchVelocity: 1050, // launch pad 'P'
    conveyorSpeed: 100,
    timedDoor: 5,         // seconds a 't' door stays open
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
