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
  {
    const savedMuted = localStorage.getItem('vsd-muted');
    videoEl.muted = savedMuted === null ? true : (savedMuted === 'true'); // شروع بی‌صدا به‌صورت پیش‌فرض
  }
  videoEl.className = 'video-frame';
  videoEl.setAttribute('playsinline', '');
  videoEl.setAttribute('webkit-playsinline', '');
  videoEl.setAttribute('draggable', 'false');
  // جلوگیری از منو/دانلود پیش‌فرض
  videoEl.addEventListener('contextmenu', e => e.preventDefault());

  container.appendChild(videoEl);

  // اسپینر لودینگ
  attachVideoSpinner(container, videoEl);

  // توقف موقت هنگام نگه‌داشتن (long-press/hold) و ادامه با رها کردن
  attachHoldPause(videoEl);

  // کلیک برای قطع/وصل صدا + نشانگر
  videoEl.addEventListener('click', toggleMuteWithIndicator);

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

  const commentBtn = document.createElement('button');
  commentBtn.innerHTML = `<span class="material-icons">comment</span>`;
  commentBtn.title = 'ارسال کامنت';
  commentBtn.onclick = openCommentPopup;
  controls.appendChild(commentBtn);

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

  // تزریق CSS حداقلی برای اجزای UI (اگر نبود)
  ensureInlineStyles();

  // نوار سفید پیشرفت بین کپشن و نوار پایین (شناور)
  createProgressBar(videoEl);
}

/**
 * توقف هنگام نگه‌داشتن روی ویدیو و ادامه با رها کردن
 * + حین نگه‌داشتن، کنترل‌ها مخفی می‌شوند و منوهای سیستم مسدود می‌شوند.
 */
function attachHoldPause(videoEl) {
  let holdTimer = null;
  let holding = false;
  let wasPlaying = false;

  const clearHoldTimer = () => {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  };

  const startHold = () => {
    clearHoldTimer();
    holdTimer = setTimeout(() => {
      holding = true;
      wasPlaying = !videoEl.paused && !videoEl.ended;
      if (wasPlaying) videoEl.pause();
      videoEl._suppressClick = true; // جلوگیری از toggle صدا بعد از رها کردن
      // حین نگه داشتن، کنترل‌ها رو مخفی کن
      const ctrls = document.querySelector('.video-controls');
      if (ctrls) ctrls.style.display = 'none';
    }, 300); // مدت زمان لازم برای تشخیص نگه‌داشتن
  };

  const endHold = () => {
    clearHoldTimer();
    if (holding) {
      holding = false;
      if (wasPlaying) videoEl.play().catch(() => {});
      setTimeout(() => { videoEl._suppressClick = false; }, 200);
      // بعد از رها کردن، کنترل‌ها رو دوباره نمایش بده
      const ctrls = document.querySelector('.video-controls');
      if (ctrls) ctrls.style.display = '';
    }
  };

  videoEl.addEventListener('pointerdown', (e) => {
    if (e.button != null && e.button !== 0) return; // فقط دکمه اصلی
    startHold();
  });
  videoEl.addEventListener('pointerup', endHold);
  videoEl.addEventListener('pointercancel', endHold);
  videoEl.addEventListener('pointerleave', endHold);

  // جلوگیری از منوی پیش‌فرض یا اکشن سیستم هنگام long-press موبایل
  videoEl.addEventListener('touchstart', (e) => {
    if (e.touches?.length === 1) e.preventDefault();
  }, { passive: false });
  videoEl.addEventListener('contextmenu', e => e.preventDefault());
}

/**
 * پاپ‌آپ کامنت
 */
function openCommentPopup() {
  const vidId = videos[currentIndex]?.id;
  const videoLink = `${location.origin}${location.pathname}#v=${vidId}`;

  const overlay = document.createElement('div');
  overlay.className = 'comment-overlay';
  overlay.innerHTML = `
    <form class="comment-box" id="commentForm" method="POST" target="_self">
      <h3>ارسال کامنت</h3>
      <input type="text" name="entry.323460201" value="${videoLink}" readonly>
      <input type="text" name="entry.381343939" placeholder="نام شما" required>
      <input type="text" name="entry.453273452" placeholder="شماره تلفن یا ایمیل" required>
      <textarea name="entry.1243005185" placeholder="پیام شما" required></textarea>
      <div class="comment-actions">
        <button type="button" id="cancelComment">انصراف</button>
        <button type="submit">ارسال</button>
      </div>
    </form>
  `;
  document.body.appendChild(overlay);

  document.getElementById('cancelComment').onclick = () => overlay.remove();

  const form = document.getElementById('commentForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    try {
      await fetch(
        'https://docs.google.com/forms/d/e/1FAIpQLSfUrQX2DmrfNv--qvMcJgiqkx2yIqz8Dg9jqw3نEr7rkY0juA/formResponse',
        { method: 'POST', mode: 'no-cors', body: formData }
      );
      showToast('پیام ارسال شد!', 'success');
      overlay.remove();
    } catch {
      showToast('ارسال ناموفق بود', 'error');
    }
  });
}

/**
 * نشانگر قطع/وصل صدا
 */
function toggleMuteWithIndicator(e) {
  const videoEl = e?.currentTarget || document.querySelector('#video-container video');
  if (!videoEl) return;

  // اگر بلافاصله بعد از نگه‌داشتن رها شده، کلیک را نادیده بگیر
  if (videoEl._suppressClick) {
    videoEl._suppressClick = false;
    return;
  }

  videoEl.muted = !videoEl.muted;
  try { localStorage.setItem('vsd-muted', String(videoEl.muted)); } catch {}

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
      videoUrl: vid.file, // همخوان با settings.js
      thumb: vid.thumb || vid.thumbnail || '',
      caption: vid.caption || ''
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
 * نوار سفید پیشرفت ویدیو (شناور، چپ به راست)
 */
function createProgressBar(videoEl) {
  // حذف نمونه قبلی
  const prev = document.querySelector('.progress-bar-wrap');
  if (prev) prev.remove();

  // ساخت عناصر
  const wrap = document.createElement('div');
  wrap.className = 'progress-bar-wrap';

  const track = document.createElement('div');
  track.className = 'progress-track';

  const fill = document.createElement('div');
  fill.className = 'progress-fill';

  const handle = document.createElement('div');
  handle.className = 'progress-handle';

  track.appendChild(fill);
  track.appendChild(handle);
  wrap.appendChild(track);
  document.body.appendChild(wrap);

  // موقعیت: بالای نوار پایین
  const nav = document.querySelector('.bottom-nav');
  const bottomOffset = nav ? (nav.getBoundingClientRect().height + 12) : 72;
  wrap.style.bottom = bottomOffset + 'px';

  // همگام‌سازی با پخش
  const sync = () => {
    const d = videoEl.duration || 0;
    const t = videoEl.currentTime || 0;
    const p = d ? Math.min(1, Math.max(0, t / d)) : 0;
    const pct = (p * 100) + '%';
    fill.style.width = pct;     // از چپ به راست
    handle.style.left = pct;    // هم‌راستا با fill
  };
  videoEl.addEventListener('timeupdate', sync);
  videoEl.addEventListener('loadedmetadata', sync);
  videoEl.addEventListener('seeking', sync);

  // اسکراب
  let seeking = false;
  const seekAt = (clientX) => {
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return;
    const p = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    if (Number.isFinite(videoEl.duration) && videoEl.duration > 0) {
      videoEl.currentTime = p * videoEl.duration;
    }
    sync();
  };

  track.addEventListener('pointerdown', e => {
    seeking = true;
    e.preventDefault();
    e.stopPropagation();
    if (track.setPointerCapture && e.pointerId != null) track.setPointerCapture(e.pointerId);
    seekAt(e.clientX);
  }, { passive: false });

  track.addEventListener('pointermove', e => {
    if (!seeking) return;
    e.preventDefault();
    seekAt(e.clientX);
  }, { passive: false });

  track.addEventListener('pointerup', e => {
    if (!seeking) return;
    seeking = false;
    e.preventDefault();
  }, { passive: false });

  // لمس: جلوگیری از سوایپ عمودی هنگام اسکراب
  track.addEventListener('touchstart', (e) => {
    e.stopPropagation(); e.preventDefault();
    if (e.touches && e.touches[0]) seekAt(e.touches[0].clientX);
    seeking = true;
  }, { passive: false });

  track.addEventListener('touchmove', (e) => {
    if (!seeking) return;
    e.stopPropagation(); e.preventDefault();
    if (e.touches && e.touches[0]) seekAt(e.touches[0].clientX);
  }, { passive: false });

  track.addEventListener('touchend', (e) => {
    seeking = false;
    e.stopPropagation(); e.preventDefault();
  }, { passive: false });

  // جلوگیری از تریگر ناوبری با چرخ ماوس روی نوار
  wrap.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });

  // اولیه
  sync();
}

/**
 * اسپینر لودینگ ویدیو
 */
function attachVideoSpinner(container, videoEl) {
  const spinner = document.createElement('div');
  spinner.className = 'video-spinner';
  spinner.innerHTML = `<div class="ring"></div>`;
  container.appendChild(spinner);

  const show = () => spinner.classList.add('show');
  const hide = () => spinner.classList.remove('show');

  videoEl.addEventListener('loadstart', show);
  videoEl.addEventListener('waiting', show);
  videoEl.addEventListener('stalled', show);

  videoEl.addEventListener('canplay', hide);
  videoEl.addEventListener('canplaythrough', hide);
  videoEl.addEventListener('playing', hide);

  videoEl.addEventListener('error', hide);
  videoEl.addEventListener('ended', hide);

  // چک اولیه
  setTimeout(() => {
    if (videoEl.readyState >= 2) hide();
    else show();
  }, 0);
}

/**
 * استایل‌های حداقلی لازم برای نشانگر صدا، دیالوگ اشتراک‌گذاری، نوار پیشرفت و اسپینر
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

  /* نوار سفید پیشرفت (شناور بین کپشن و نوار پایین) */
  .progress-bar-wrap {
    position: fixed;
    left: 0; right: 0;
    bottom: 72px; /* مقدار دقیق با JS تنظیم می‌شود */
    z-index: 9000;
    padding: 8px 16px;
    pointer-events: none; /* فقط خود ترک کلیک‌پذیر باشد */
  }
  .progress-track {
    width: 100%;
    height: 6px;
    background: rgba(255,255,255,0.35);
    border-radius: 999px;
    position: relative;
    pointer-events: auto; /* قابل کلیک/لمس */
    -webkit-tap-highlight-color: transparent;
    direction: ltr; /* تضمین چپ به راست */
  }
  .progress-fill {
    position: absolute;
    left: 0; top: 0;
    height: 100%;
    width: 0%;
    background: #fff;
    border-radius: inherit;
    transition: width .06s linear;
  }
  .progress-handle {
    position: absolute;
    top: 50%;
    left: 0%;
    transform: translate(-50%, -50%);
    width: 12px; height: 12px;
    background: #fff;
    border-radius: 50%;
    box-shadow: 0 0 0 2px rgba(0,0,0,0.2);
  }

  /* اسپینر لودینگ ویدیو */
  .video-spinner {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    opacity: 0; transition: opacity .2s ease;
    pointer-events: none;
  }
  .video-spinner.show { opacity: 1; }
  .video-spinner .ring {
    width: 48px; height: 48px;
    border: 3px solid rgba(255,255,255,0.35);
    border-top-color: #fff;
    border-radius: 50%;
    animation: vsd-spin 1s linear infinite;
  }
  @keyframes vsd-spin { to { transform: rotate(360deg); } }

  /* جلوگیری از منوی نگه‌داشتن و انتخاب متن روی ویدئو */
  .video-frame {
    -webkit-touch-callout: none; -webkit-user-select: none; user-select: none;
  }
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
