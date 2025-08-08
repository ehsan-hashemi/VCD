// js/feed.js

let videos = [];
let currentIndex = 0;
let isNavigating = false; // برای جلوگیری از اسکرول‌های پیاپی

/**
 * Helpers: per-user/guest storage
 */
const Store = {
  currentPhone: () => localStorage.getItem('currentUser') || null,

  getSaved(phone) {
    const key = phone ? `saved:${phone}` : 'saved:guest';
    return JSON.parse(localStorage.getItem(key) || '[]');
  },
  setSaved(phone, arr) {
    const key = phone ? `saved:${phone}` : 'saved:guest';
    localStorage.setItem(key, JSON.stringify(arr));
  },

  getViews(phone) {
    const key = phone ? `views:${phone}` : 'views:guest';
    return JSON.parse(localStorage.getItem(key) || '{}');
  },
  setViews(phone, obj) {
    const key = phone ? `views:${phone}` : 'views:guest';
    localStorage.setItem(key, JSON.stringify(obj));
  },

  // برای سازگاری با نسخه‌های قدیمی (در صورت نیاز)
  getLegacySavedIds() {
    return JSON.parse(localStorage.getItem('saved') || '[]');
  },
  setLegacySavedIds(arr) {
    localStorage.setItem('saved', JSON.stringify(arr));
  },
  getLegacyViews() {
    return JSON.parse(localStorage.getItem('views') || '{}');
  },
  setLegacyViews(obj) {
    localStorage.setItem('views', JSON.stringify(obj));
  }
};

/**
 * نمایش یا مخفی کردن بنر آفلاین
 */
function updateOnlineStatus() {
  const banner = document.getElementById('offline-banner');
  if (navigator.onLine) banner.classList.add('hidden');
  else banner.classList.remove('hidden');
}

/**
 * پیمایش بین ویدیوها (بالا = بعدی، پایین = قبلی)
 * @param {number} delta +1 برای بعدی، -1 برای قبلی
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
 * بارگذاری و پخش یک ویدیو
 * @param {number} idx
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

  // اجرای اجباری (در برخی مرورگرها)
  videoEl.addEventListener('loadeddata', () => {
    const p = videoEl.play();
    if (p && p.catch) p.catch(() => {});
  });

  // کلیک برای قطع/وصل صدا
  videoEl.addEventListener('click', () => {
    videoEl.muted = !videoEl.muted;
  });

  container.appendChild(videoEl);

  // کنترل‌های ویدیو
  const controls = document.createElement('div');
  controls.className = 'video-controls';

  // دکمه ذخیره
  const saveBtn = document.createElement('button');
  saveBtn.innerHTML = `<span class="material-icons">bookmark_border</span>`;
  saveBtn.title = 'ذخیره ویدیو';
  saveBtn.onclick = toggleSave;
  controls.appendChild(saveBtn);

  // دکمه اشتراک‌گذاری
  const shareBtn = document.createElement('button');
  shareBtn.innerHTML = `<span class="material-icons">share</span>`;
  shareBtn.title = 'اشتراک‌گذاری';
  shareBtn.onclick = () => shareVideo(window.location.origin + window.location.pathname + `#v=${vid.id}`);
  controls.appendChild(shareBtn);

  // دکمه دانلود
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

  // کپشن (با هشتگ و امکان گسترش)
  if (vid.caption) {
    const cap = document.createElement('div');
    cap.className = 'caption';
    cap.innerHTML = formatCaption(vid.caption);
    cap.addEventListener('click', () => cap.classList.toggle('expanded'));
    attachHashtagEvents(cap);
    container.appendChild(cap);
  }

  // شمارش بازدید
  incrementViewCounts();

  // آیکون ذخیره را تنظیم کن
  updateSaveIcon();
}

/**
 * فرمت کردن کپشن و تبدیل هشتگ‌ها
 */
function formatCaption(text) {
  return (text || '').replace(/#(\S+)/g, `<span class="hashtag">#$1</span>`);
}

/**
 * رویداد کلیک روی هشتگ‌ها
 */
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
 * ذخیره/حذف ویدیو در لیست ذخیره‌شده‌ها (با ساختار شیء)
 */
function toggleSave() {
  const vid = videos[currentIndex];
  const phone = Store.currentPhone();

  // آرایه‌ی ذخیره‌ها (برای کاربر یا مهمان)
  const savedList = Store.getSaved(phone);

  const idx = savedList.findIndex(x => String(x.id) === String(vid.id));
  if (idx === -1) {
    // اضافه کردن شیء کامل
    savedList.push({
      id: vid.id,
      src: vid.file,
      thumb: vid.thumb || vid.thumbnail || '',
      caption: vid.caption || ''
    });
    showToast('به ذخیره‌ها اضافه شد', 'success');
  } else {
    // حذف
    savedList.splice(idx, 1);
    showToast('از ذخیره‌ها حذف شد', 'success');
  }

  Store.setSaved(phone, savedList);

  // برای سازگاری با نسخه قدیمی (فقط لیست آیدی‌ها)
  try {
    const legacyIds = Store.getLegacySavedIds();
    const legacyIdx = legacyIds.indexOf(vid.id);
    if (idx === -1 && legacyIdx === -1) {
      legacyIds.push(vid.id);
    } else if (idx !== -1 && legacyIdx !== -1) {
      legacyIds.splice(legacyIdx, 1);
    }
    Store.setLegacySavedIds(legacyIds);
  } catch {}

  updateSaveIcon();
}

/**
 * تغییر آیکون ذخیره بر اساس وضعیت
 */
function updateSaveIcon() {
  const phone = Store.currentPhone();
  const vidId = videos[currentIndex]?.id;
  const savedList = Store.getSaved(phone);
  const isSaved = savedList.some(x => String(x.id) === String(vidId));
  const ico = document.querySelector('.video-controls button:first-child .material-icons');
  if (ico) ico.textContent = isSaved ? 'bookmark' : 'bookmark_border';
}

/**
 * شمارش بازدید روزانه و ماهانه (برای مهمان و اگر وارد شده، برای کاربر)
 */
function incrementViewCounts() {
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);

  const phone = Store.currentPhone();

  // guest
  const g = Store.getViews(null);
  if (g.lastDay === today) g.daily = (g.daily || 0) + 1;
  else { g.daily = 1; g.lastDay = today; }
  if (g.lastMonth === month) g.monthly = (g.monthly || 0) + 1;
  else { g.monthly = 1; g.lastMonth = month; }
  Store.setViews(null, g);

  // per-user (اگر وارد شده بود)
  if (phone) {
    const u = Store.getViews(phone);
    if (u.lastDay === today) u.daily = (u.daily || 0) + 1;
    else { u.daily = 1; u.lastDay = today; }
    if (u.lastMonth === month) u.monthly = (u.monthly || 0) + 1;
    else { u.monthly = 1; u.lastMonth = month; }
    Store.setViews(phone, u);
  }

  // سازگاری قدیمی
  try {
    const legacy = Store.getLegacyViews();
    if (legacy.lastDay === today) legacy.daily = (legacy.daily || 0) + 1;
    else { legacy.daily = 1; legacy.lastDay = today; }
    if (legacy.lastMonth === month) legacy.monthly = (legacy.monthly || 0) + 1;
    else { legacy.monthly = 1; legacy.lastMonth = month; }
    Store.setLegacyViews(legacy);
  } catch {}
}

/**
 * اشتراک‌گذاری یا کپی لینک
 */
function shareVideo(url) {
  if (navigator.share) {
    navigator.share({ title: 'ویدیو جالب!', text: 'این ویدیو رو ببین:', url })
      .catch(() => showToast('امکان اشتراک‌گذاری وجود ندارد', 'error'));
  } else {
    navigator.clipboard.writeText(url)
      .then(() => showToast('لینک کپی شد!', 'success'))
      .catch(() => showToast('کپی لینک انجام نشد', 'error'));
  }
}

/**
 * پیام موقت
 */
function showToast(message, type) {
  const t = document.createElement('div');
  t.className = `toast toast-${type === 'error' ? 'error' : 'success'}`;
  t.textContent = message;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

/**
 * بارگذاری اولیه و رویدادها
 */
document.addEventListener('DOMContentLoaded', () => {
  updateOnlineStatus();
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);

  // واکشی ویدیوها
  fetch('data/videos.json')
    .then(res => {
      if (!res.ok) throw new Error('دریافت ویدیوها با خطا مواجه شد');
      return res.json();
    })
    .then(data => {
      videos = data.sort((a, b) => b.id - a.id);

      // اگر از saved یا search آمده‌ایم
      const hashParams = new URLSearchParams(location.hash.slice(1));
      const deepId = hashParams.get('v');
      const intent = localStorage.getItem('openVideo');

      if (intent) {
        try {
          const obj = JSON.parse(intent);
          const idx = videos.findIndex(v => String(v.id) === String(obj.id));
          if (idx >= 0) {
            loadVideo(idx);
          } else {
            loadVideo(0);
          }
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

  // پیمایش با اسکرول: بالا (deltaY < 0) = بعدی، پایین = قبلی
  window.addEventListener("wheel", e => {
    e.preventDefault();
    navigate(e.deltaY > 0 ? 1 : -1); // اگر اسکرول پایین بود، برو جلوتر
  }, { passive: false });

  // کلیدهای جهت‌نما (اختیاری)
  window.addEventListener('keydown', e => {
    if (e.key === 'ArrowUp') navigate(+1);
    else if (e.key === 'ArrowDown') navigate(-1);
  });

  // نوار پایین
  document.getElementById('nav-home').onclick = () => location.href = '/index.html';
  document.getElementById('nav-search').onclick = () => location.href = '/search.html';
  document.getElementById('nav-add').onclick = () => {
    location.href = 'https://docs.google.com/forms/d/e/1FAIpQLSd3zvLky2JWoa7Z5XmTS7gh2iUVnSgYYU_Hk14_01RuDsRMnw/viewform?usp=header';
  };
  document.getElementById('nav-settings').onclick = () => location.href = '/settings.html';
});