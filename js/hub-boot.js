// small glue: expose the Phaser scene to Hub, music picker, guest-side app ref
(function () {
  // ♫ track picker (Chinese lo-fi names)
  const btn = document.getElementById('btn-music');
  if (btn) btn.onclick = () => {
    Sfx.unlock();
    let el = document.getElementById('music-pop');
    if (el) { el.remove(); return; }
    el = document.createElement('div'); el.id = 'music-pop'; el.className = 'card music-pop';
    const T = Sfx.TRACKS;
    el.innerHTML = '<h2>选音乐</h2>' +
      `<button class="btn small ${Sfx.pick === 'auto' ? 'warm' : ''}" data-t="auto">跟着场景自动</button>` +
      Object.entries(T).map(([id, t]) => `<button class="btn small ${Sfx.pick === id ? 'warm' : ''}" data-t="${id}">${t.name} · ${t.bpm}</button>`).join('') +
      `<label class="vol">音乐 <input type="range" min="0" max="1" step="0.05" value="${Sfx.musicVol}" id="mv"></label>` +
      `<label class="vol">音效 <input type="range" min="0" max="1" step="0.05" value="${Sfx.sfxVol}" id="sv"></label>` +
      `<button class="btn small ${Sfx.clean ? '' : 'ghost'}" id="clean">${Sfx.clean ? '✓ 纯净音效（无底噪）' : '纯净音效：关（有雨声/黑胶底噪）'}</button>` +
      `<label class="btn small ghost file">自己的音乐（只在本机播放）<input type="file" accept="audio/*" id="byo" hidden></label>` +
      `<button class="btn small ghost" data-t="close">关闭</button>`;
    document.getElementById('wrap').appendChild(el);
    el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { if (b.dataset.t !== 'close') Sfx.pickTrack(b.dataset.t); el.remove(); });
    el.querySelector('#clean').onclick = (e) => { Sfx.setClean && Sfx.setClean(!Sfx.clean); const b = e.target; b.textContent = Sfx.clean ? '✓ 纯净音效（无底噪）' : '纯净音效：关（有雨声/黑胶底噪）'; b.classList.toggle('ghost', !Sfx.clean); };
    el.querySelector('#mv').oninput = (e) => Sfx.setMusicVol(+e.target.value);
    el.querySelector('#sv').oninput = (e) => Sfx.setSfxVol(+e.target.value);
    el.querySelector('#byo').onchange = (e) => { const f = e.target.files[0]; if (f) { Sfx.useFile(f); el.remove(); } };
  };
})();
