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
    // migrate legacy saved ids -> guest saved objects (حداقل id و src)
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

    // migrate legacy views (جمع به‌عنوان summary)
    try {
      const legacy = JSON.parse(localStorage.getItem(KEYS.legacyViews) || 'null');
      if (legacy && typeof legacy === 'object') {
        const sum = Store.getViewsSummary();
        // فقط اگر خالی بود، انتقال می‌دهیم
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

/**
 * بنر آفلاین
 */
function updateOnlineStatus() {
  const banner = document.getElementById('offline-banner');
  if (!banner) return;
  if (navigator.onLine) banner.classList.add('hidden');
  else banner.classList.remove('hidden');
}

/**
 * ناوبری بین ویدیوها (سوایپ بالا/اسکرول بالا = بعدی | پایین = قبلی)
 */
function navigate(delta) {
  if (isNavigating) return;
  const newIndex = currentIndex + delta;
  if (newIndex < 0 || newIndex >= videos.length) return;
  isNavigating = true;
  loadVideo(newIndex);
  setTimeout(() => (isNavigating = false), 350);
}

/**
 * بارگذاری ویدیو و راه‌اندازی اکشن‌ها
 */
function loadVideo(idx) {
  currentIndex = idx;

  const container = document.getElementById('video-container');
  container.innerHTML = '';

  const vid = videos[idx];

  // عنصر ویدیو
  const videoEl = document.createElement('video');
  videoEl.src = vid.file;
  videoEl.autoplay = true;
  videoEl.loop = true;
  videoEl.playsInline = true;
  videoEl.muted = true; // شروع بی‌صدا
  videoEl.className = 'video-frame';

  // اجرای اجباری
  videoEl.addEventListener("click", () => {
    videoEl.muted = !videoEl.muted;
    localStorage.setItem("vsd-muted", String(videoEl.muted)); // ذخیره دائمی وضعیت صدا
  });

  // کلیک/تاچ برای قطع/وصل صدا + نشانگر
  videoEl.addEventListener('click', toggleMuteWithIndicator);
  videoEl.addEventListener('touchend', (e) => {
    // جلوگیری از تداخل با سوایپ: اگر لمس کوتاه بود
    if (e.changedTouches && e.changedTouches.length === 1) {
      toggleMuteWithIndicator();
    }
  });

  container.appendChild(videoEl);

  // کنترل‌ها
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

  // کپشن
  if (vid.caption) {
    const cap = document.createElement('div');
    cap.className = 'caption';
    cap.innerHTML = formatCaption(vid.caption);
    cap.addEventListener('click', () => cap.classList.toggle('expanded'));
    attachHashtagEvents(cap);
    container.appendChild(cap);
  }

  // شمارش بازدید یکتا
  incrementViewCounts(vid.id);

  // آیکون ذخیره
  updateSaveIcon();

  // تزریق CSS حداقلی برای نشانگر صدا (اگر نبود)
  ensureInlineStyles();
}

/**
 * نشانگر قطع/وصل صدا
 */
function toggleMuteWithIndicator() {
  const videoEl = document.querySelector('#video-container video');
  if (!videoEl) return;
  videoEl.muted = !videoEl.muted;

  const indicator = document.createElement('div');
  indicator.className = 'volume-indicator';
  indicator.innerHTML = `<span class="material-icons">${videoEl.muted ? 'volume_off' : 'volume_up'}</span>`;
  document.getElementById('video-container').appendChild(indicator);
  requestAnimationFrame(() => indicator.classList.add('show'));
  setTimeout(() => indicator.classList.remove('show'), 700);
  setTimeout(() => indicator.remove(), 1000);
}

/**
 * کپشن با هشتگ کلیک‌پذیر
 */
function formatCaption(text) {
  return (text || '').replace(/#(\S+)/g, `<span class="hashtag">#$1</span>`);
}
function attachHashtagEvents(capEl) {
  capEl.querySelectorAll('.hashtag').forEach(span => {
    span.onclick = e => {
      e.stopPropagation();
      const tag = span.textContent.replace('#', '');
      location.href = `search.html?tag=${encodeURIComponent(tag)}`;
    };
  });
}

/**
 * ذخیره/حذف ویدیو
 */
function toggleSave() {
  const vid = videos[currentIndex];
  const phone = Store.currentPhone();
  const savedList = Store.getSaved(phone);

  const idx = savedList.findIndex(x => String(x.id) === String(vid.id));
  if (idx === -1) {
    savedList.push({
      id: vid.id,
      videoUrl: vid.file, // تطابق با settings.js
      caption: vid.caption || '',
      thumb: vid.thumb || vid.thumbnail || ''
    });
    showToast('به ذخیره‌ها اضافه شد', 'success');
  } else {
    savedList.splice(idx, 1);
    showToast('از ذخیره‌ها حذف شد', 'success');
  }
  Store.setSaved(phone, savedList);

  // هم‌خوانی با آیکون
  updateSaveIcon();
}

/**
 * آیکون ذخیره
 */
function updateSaveIcon() {
  const vidId = videos[currentIndex]?.id;
  const phone = Store.currentPhone();
  const savedList = Store.getSaved(phone);
  const isSaved = savedList.some(x => String(x.id) === String(vidId));
  const ico = document.querySelector('.video-controls button:first-child .material-icons');
  if (ico) ico.textContent = isSaved ? 'bookmark' : 'bookmark_border';
}

/**
 * بازدید یکتا: summary (روز/ماه) + perVideo (توتال یکتا)
 */
function incrementViewCounts(videoId) {
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);

  // خلاصه‌ی روز/ماه با لیست یکتا
  const sum = Store.getViewsSummary();
  if (sum.lastDay !== today) {
    sum.lastDay = today;
    sum.daily = 0;
    sum.seenToday = [];
  }
  if (sum.lastMonth !== month) {
    sum.lastMonth = month;
    sum.monthly = 0;
    sum.seenThisMonth = [];
  }
  if (!sum.seenToday.includes(videoId)) {
    sum.daily += 1;
    sum.seenToday.push(videoId);
  }
  if (!sum.seenThisMonth.includes(videoId)) {
    sum.monthly += 1;
    sum.seenThisMonth.push(videoId);
  }
  Store.setViewsSummary(sum);

  // یکتای هر ویدیو (مادام‌العمر)
  const per = Store.getPerVideoViews();
  if (!per[videoId]) {
    per[videoId] = { totalUnique: 1, lastSeenDay: today };
  } else {
    // فقط اولین بار شمرده می‌شود؛ اما lastSeenDay را به‌روز می‌کنیم
    if (per[videoId].lastSeenDay !== today) {
      per[videoId].lastSeenDay = today;
    }
  }
  Store.setPerVideoViews(per);
}

/**
 * اشتراک‌گذاری پایدار روی موبایل
 */
function shareVideo(url) {
  const doCopy = () => {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(url)
        .then(() => showToast('لینک کپی شد!', 'success'))
        .catch(() => fallbackShareDialog(url));
    } else {
      fallbackShareDialog(url);
      return Promise.resolve();
    }
  };

  if (navigator.share) {
    navigator.share({ title: 'ویدیو جالب!', text: 'این ویدیو رو ببین:', url })
      .catch(() => doCopy());
  } else {
    doCopy();
  }
}

function fallbackShareDialog(url) {
  // یک دیالوگ ساده با ورودی قابل انتخاب
  const wrap = document.createElement('div');
  wrap.className = 'share-fallback';
  wrap.innerHTML = `
    <div class="share-box">
      <div class="share-title">لینک را کپی کنید</div>
      <input class="share-input" value="${url}" readonly />
      <button class="share-close"><span class="material-icons">close</span></button>
    </div>
  `;
  document.body.appendChild(wrap);
  const input = wrap.querySelector('.share-input');
  input.select();
  input.setSelectionRange(0, 99999);
  try { document.execCommand('copy'); showToast('لینک کپی شد!', 'success'); } catch {}
  wrap.querySelector('.share-close').onclick = () => wrap.remove();
  wrap.addEventListener('click', (e) => { if (e.target === wrap) wrap.remove(); });
}

/**
 * Toast
 */
function showToast(message, type) {
  const t = document.createElement('div');
  t.className = `toast toast-${type === 'error' ? 'error' : 'success'}`;
  t.textContent = message;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

/**
 * استایل‌های حداقلی لازم برای نشانگر صدا و دیالوگ اشتراک‌گذاری
 */
function ensureInlineStyles() {
  if (document.getElementById('vsd-inline-styles')) return;
  const css = `
  .volume-indicator {
    position: absolute; inset: 0; display:flex; align-items:center; justify-content:center;
    opacity:0; pointer-events:none; transition:opacity .2s ease;
  }
  .volume-indicator .material-icons {
    font-size: 64px; color: rgba(255,255,255,0.9); text-shadow: 0 2px 12px rgba(0,0,0,0.6);
  }
  .volume-indicator.show { opacity:1; }
  .share-fallback {
    position: fixed; inset:0; background: rgba(0,0,0,.4); display:flex; align-items:center; justify-content:center; z-index: 9999;
  }
  .share-box {
    background:#1e1e1e; color:#fff; border-radius:12px; padding:16px; width:min(90vw,480px); position:relative; box-shadow:0 10px 30px rgba(0,0,0,.4);
  }
  .share-title { font-weight:700; margin-bottom:8px; }
  .share-input {
    width:100%; padding:12px; border:1px solid #444; border-radius:8px; background:#111; color:#fff; direction:ltr;
  }
  .share-close { position:absolute; top:8px; left:8px; background:transparent; border:0; color:#fff; cursor:pointer; }
  `;
  const style = document.createElement('style');
  style.id = 'vsd-inline-styles';
  style.textContent = css;
  document.head.appendChild(style);
}

/**
 * رویدادهای اولیه
 */
document.addEventListener('DOMContentLoaded', () => {
  updateOnlineStatus();
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);

  fetch('data/videos.json')
    .then(res => {
      if (!res.ok) throw new Error('دریافت ویدیوها با خطا مواجه شد');
      return res.json();
    })
    .then(data => {
      videos = (data || []).sort((a, b) => b.id - a.id);

      // مهاجرت داده‌ها بعد از اینکه ویدیوها را داریم
      Store.migrate();

      // دیپ‌لینک #v
      const deepId = new URLSearchParams(location.hash.slice(1)).get('v');
      const intent = localStorage.getItem('openVideo');

      if (intent) {
        try {
          const obj = JSON.parse(intent);
          const idx = videos.findIndex(v => String(v.id) === String(obj.id));
          loadVideo(idx >= 0 ? idx : 0);
        } catch {
          loadVideo(0);
        } finally {
          localStorage.removeItem('openVideo');
        }
      } else if (deepId) {
        const i = videos.findIndex(v => String(v.id) === String(deepId));
        loadVideo(i >= 0 ? i : 0);
      } else {
        loadVideo(0);
      }
    })
    .catch(err => showToast(err.message, 'error'));

  // اسکرول ماوس: بالا = بعدی، پایین = قبلی (مطابق خواسته‌ات)
  window.addEventListener('wheel', e => {
    e.preventDefault();
    navigate(e.deltaY < 0 ? +1 : -1);
  }, { passive: false });

  // سوایپ موبایل: up => next, down => prev
  let touchStartY = null;
  let touchStartX = null;
  const SWIPE_THRESHOLD = 50; // px
  window.addEventListener('touchstart', e => {
    if (!e.touches || !e.touches.length) return;
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  window.addEventListener('touchend', e => {
    if (!e.changedTouches || !e.changedTouches.length) return;
    const dy = e.changedTouches[0].clientY - touchStartY;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > SWIPE_THRESHOLD) {
      // سوایپ عمودی
      navigate(dy < 0 ? +1 : -1); // بالا (dy منفی) = بعدی
    }
  }, { passive: true });

  // ناوبری پایین
  document.getElementById('nav-home').onclick = () => location.href = 'index.html';
  document.getElementById('nav-search').onclick = () => location.href = 'search.html';
  document.getElementById('nav-add').onclick = () => {
    location.href = 'https://docs.google.com/forms/d/e/1FAIpQLSd3zvLky2JWoa7Z5XmTS7gh2iUVnSgYYU_Hk14_01RuDsRMnw/viewform?usp=header';
  };
  document.getElementById('nav-settings').onclick = () => location.href = 'settings.html';
});
