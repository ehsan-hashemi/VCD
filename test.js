// js/feed.js

let videos = [];
let currentIndex = 0;
let isNavigating = false; // دیبانس ناوبری

// کلیدهای پایدار
const KEYS = {
  savedGuest: 'vsd:saved:guest',
  savedUserPrefix: 'vsd:saved:', // + phone
  viewsSummary: 'vsd:views:summary',
  videoViews: 'vsd:views:perVideo',
  legacySaved: 'saved',
  legacyViews: 'views',
  currentUser: 'currentUser'
};

// استور ساده + مهاجرت از کلیدهای قدیمی
const Store = {
  currentPhone: () => localStorage.getItem(KEYS.currentUser) || null,

  getSaved(phone) {
    const key = phone ? `${KEYS.savedUserPrefix}${phone}` : KEYS.savedGuest;
    return JSON.parse(localStorage.getItem(key) || '[]');
  },
  setSaved(phone, arr) {
    const key = phone ? `${KEYS.savedUserPrefix}${phone}` : KEYS.savedGuest;
    localStorage.setItem(key, JSON.stringify(arr));
  },

  getViewsSummary() {
    return JSON.parse(localStorage.getItem(KEYS.viewsSummary) || 'null') || {
      lastDay: null,
      daily: 0,
      seenToday: [],
      lastMonth: null,
      monthly: 0,
      seenThisMonth: []
    };
  },
  setViewsSummary(obj) {
    localStorage.setItem(KEYS.viewsSummary, JSON.stringify(obj));
  },
  getPerVideoViews() {
    return JSON.parse(localStorage.getItem(KEYS.videoViews) || '{}');
  },
  setPerVideoViews(obj) {
    localStorage.setItem(KEYS.videoViews, JSON.stringify(obj));
  },

  migrate() {
    try {
      const legacyIds = JSON.parse(localStorage.getItem(KEYS.legacySaved) || '[]');
      if (Array.isArray(legacyIds) && legacyIds.length) {
        const guest = Store.getSaved(null);
        const missing = legacyIds.filter(id => !guest.some(x => String(x.id) === String(id)));
        if (missing.length && Array.isArray(videos) && videos.length) {
          missing.forEach(id => {
            const v = videos.find(x => String(x.id) === String(id));
            if (v) guest.push({ id: v.id, src: v.file, thumb: v.thumb || v.thumbnail || '', caption: v.caption || '' });
          });
          Store.setSaved(null, guest);
        }
      }
    } catch {}

    try {
      const legacy = JSON.parse(localStorage.getItem(KEYS.legacyViews) || 'null');
      if (legacy && typeof legacy === 'object') {
        const sum = Store.getViewsSummary();
        if (!sum.lastDay && !sum.lastMonth) {
          Store.setViewsSummary({
            lastDay: legacy.lastDay || null,
            daily: legacy.daily || 0,
            seenToday: [],
            lastMonth: legacy.lastMonth || null,
            monthly: legacy.monthly || 0,
            seenThisMonth: []
          });
        }
      }
    } catch {}
  }
};

// 🆕 گرفتن thumbnail از وسط ویدیو
async function getMiddleFrameThumbnail(videoUrl) {
  return new Promise((resolve) => {
    try {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.src = videoUrl;
      video.muted = true;
      video.playsInline = true;
      video.onerror = () => resolve(null);
      video.addEventListener('loadedmetadata', () => {
        if (!video.duration || !video.videoWidth || !video.videoHeight) {
          return resolve(null);
        }
        const middleSec = video.duration / 2;
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
        try { video.currentTime = middleSec; } catch { resolve(null); }
      }, { once: true });
    } catch { resolve(null); }
  });
}

function updateOnlineStatus() {
  const banner = document.getElementById('offline-banner');
  if (!banner) return;
  if (navigator.onLine) banner.classList.add('hidden');
  else banner.classList.remove('hidden');
}

function navigate(delta) {
  if (isNavigating) return;
  const newIndex = currentIndex + delta;
  if (newIndex < 0 || newIndex >= videos.length) return;
  isNavigating = true;
  loadVideo(newIndex);
  setTimeout(() => (isNavigating = false), 350);
}

function loadVideo(idx) {
  currentIndex = idx;
  const container = document.getElementById('video-container');
  container.innerHTML = '';
  const vid = videos[idx];

  const videoEl = document.createElement('video');
  videoEl.src = vid.file;
  videoEl.autoplay = true;
  videoEl.loop = true;
  videoEl.playsInline = true;
  videoEl.muted = localStorage.getItem("vsd-muted") === true;
  videoEl.className = 'video-frame';

  videoEl.addEventListener("click", () => {
    videoEl.muted = !videoEl.muted;
  });
  videoEl.addEventListener('click', toggleMuteWithIndicator);
  videoEl.addEventListener('touchend', (e) => {
    if (e.changedTouches && e.changedTouches.length === 1) {
      toggleMuteWithIndicator();
    }
  });
  container.appendChild(videoEl);

  const controls = document.createElement('div');
  controls.className = 'video-controls';

  const saveBtn = document.createElement('button');
  saveBtn.innerHTML = `<span class="material-icons">bookmark_border</span>`;
  saveBtn.title = 'ذخیره ویدیو';
  saveBtn.onclick = toggleSave;
  controls.appendChild(saveBtn);

  const shareBtn = document.createElement('button');
  shareBtn.innerHTML = `<span class="material-icons">share</span>`;
  shareBtn.title = 'اشتراک‌گذاری';
  shareBtn.onclick = () => {
    const url = `${location.origin}${location.pathname}#v=${vid.id}`;
    shareVideo(url);
  };
  controls.appendChild(shareBtn);

  const dlBtn = document.createElement('button');
  dlBtn.innerHTML = `<span class="material-icons">file_download</span>`;
  dlBtn.title = 'دانلود ویدیو';
  dlBtn.onclick = () => {
    const a = document.createElement('a');
    a.href = vid.file;
    a.download = '';
    a.click();
  };
  controls.appendChild(dlBtn);

  container.appendChild(controls);

  if (vid.caption) {
    const cap = document.createElement('div');
    cap.className = 'caption';
    cap.innerHTML = formatCaption(vid.caption);
    cap.addEventListener('click', () => cap.classList.toggle('expanded'));
    attachHashtagEvents(cap);
    container.appendChild(cap);
  }

  incrementViewCounts(vid.id);
  updateSaveIcon();
  ensureInlineStyles();
}

function toggleMuteWithIndicator() { /* بدون تغییر */ }
function formatCaption(text) { return (text || '').replace(/#(\S+)/g, `<span class="hashtag">#$1</span>`); }
function attachHashtagEvents(capEl) { /* بدون تغییر */ }

async function toggleSave() {
  const vid = videos[currentIndex];
  const phone = Store.currentPhone();
  const savedList = Store.getSaved(phone);

  const idx = savedList.findIndex(x => String(x.id) === String(vid.id));
  if (idx === -1) {
    let thumb = vid.thumb || vid.thumbnail || '';
    if (!thumb) {
      thumb = await getMiddleFrameThumbnail(vid.file);
    }
    savedList.push({
      id: vid.id,
      videoUrl: vid.file,
      thumb: thumb,
      caption: vid.caption || ''
    });
    showToast('به ذخیره‌ها اضافه شد', 'success');
  } else {
    savedList.splice(idx, 1);
    showToast('از ذخیره‌ها حذف شد', 'success');
  }
  Store.setSaved(phone, savedList);
  updateSaveIcon();
}

// ادامه فایل بدون تغییر...
