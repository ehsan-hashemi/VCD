// File: js/saved.js
document.addEventListener('DOMContentLoaded', () => {
  (function migrateAll() {
    const phone = localStorage.getItem('currentUser') || null;

    const legacyGuest = localStorage.getItem('saved:guest');
    if (legacyGuest && !localStorage.getItem('vsd:saved:guest')) {
      localStorage.setItem('vsd:saved:guest', legacyGuest);
    }
    if (phone) {
      const legacyUser = localStorage.getItem(`saved:${phone}`);
      if (legacyUser && !localStorage.getItem(`vsd:saved:${phone}`)) {
        localStorage.setItem(`vsd:saved:${phone}`, legacyUser);
      }
    }

    const key = phone ? `vsd:saved:${phone}` : 'vsd:saved:guest';
    try {
      const saved = JSON.parse(localStorage.getItem(key) || '[]');
      let changed = false;
      const updated = saved.map(item => {
        if (item && typeof item === 'object' && !item.videoUrl && item.src) {
          item.videoUrl = item.src;
          delete item.src;
          changed = true;
        }
        return item;
      });
      if (changed) localStorage.setItem(key, JSON.stringify(updated));
    } catch {}
  })();

  // اینجا id درست رو می‌گیریم
  const container = document.getElementById('saved-videos');
  const emptyMsg = document.getElementById('saved-empty');

  const phone = localStorage.getItem('currentUser') || null;
  const key = phone ? `vsd:saved:${phone}` : 'vsd:saved:guest';

  async function getFirstFrameThumbnail(videoUrl, atSec = 0.3) {
    return new Promise((resolve) => {
      try {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.src = videoUrl;
        video.muted = true;
        video.playsInline = true;
        video.onerror = () => resolve(null);
        video.addEventListener('loadedmetadata', () => {
          if (!video.videoWidth || !video.videoHeight) return resolve(null);
          const t = Math.min(Math.max(atSec, 0), (video.duration || 1) - 0.01);
          const onSeeked = () => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            let url = null;
            try { url = canvas.toDataURL('image/jpeg', 0.75); } catch {}
            resolve(url);
          };
          video.addEventListener('seeked', onSeeked, { once: true });
          try { video.currentTime = t; } catch { resolve(null); }
        }, { once: true });
      } catch { resolve(null); }
    });
  }

  async function render() {
    const saved = JSON.parse(localStorage.getItem(key) || '[]');
    container.innerHTML = '';

    if (!saved.length) {
      emptyMsg.style.display = 'block';
      return;
    }

    emptyMsg.style.display = 'none';
    const list = saved.slice().reverse();
    let mutated = false;

    for (let i = 0; i < list.length; i++) {
      const item = { ...list[i] };

      if (!item.thumb && (item.videoUrl || item.url || item.src)) {
        const thumb = await getFirstFrameThumbnail(item.videoUrl || item.url || item.src);
        if (thumb) {
          item.thumb = thumb;
          const realIndex = saved.findIndex(s => s.id === item.id);
          if (realIndex > -1) { saved[realIndex] = item; mutated = true; }
          list[i] = item;
        }
      }

      const div = document.createElement('div');
      div.className = 'saved-item';
      div.title = item.caption || 'ویدیو ذخیره‌شده';

      const thumbImg = document.createElement('img');
      thumbImg.src = item.thumb || 'https://via.placeholder.com/160x285?text=No+Thumb';
      thumbImg.alt = 'thumbnail';
      thumbImg.style.width = '100%';
      thumbImg.style.height = '100%';
      thumbImg.style.objectFit = 'cover';
      div.appendChild(thumbImg);

      div.addEventListener('click', () => {
        localStorage.setItem('openVideo', JSON.stringify(item));
        location.href = 'index.html';
      });

      container.appendChild(div);
    }

    if (mutated) {
      localStorage.setItem(key, JSON.stringify(saved));
    }
  }

  render();

  document.getElementById('nav-home').onclick = () => location.href = 'index.html';
  document.getElementById('nav-search').onclick = () => location.href = 'search.html';
  document.getElementById('nav-add').onclick = () => {
    location.href = 'https://docs.google.com/forms/d/e/1FAIpQLSd3zvLky2JWoa7Z5XmTS7gh2iUVnSgYYU_Hk14_01RuDsRMnw/viewform?usp=header';
  };
  document.getElementById('nav-settings').onclick = () => location.href = 'settings.html';
});