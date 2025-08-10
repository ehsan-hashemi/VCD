// File: js/settings.js
document.addEventListener('DOMContentLoaded', () => {
  // 0) Migration: unify keys to vsd:* and normalize saved items {videoUrl}
  (function migrateAll() {
    const phone = localStorage.getItem('currentUser') || null;

    // Move saved:guest -> vsd:saved:guest, saved:{phone} -> vsd:saved:{phone}
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

    // Normalize saved structure: src -> videoUrl
    const key = phone ? `vsd:saved:${phone}` : 'vsd:saved:guest';
    try {
      const saved = JSON.parse(localStorage.getItem(key) || '[]');
      let changed = false;
      const updated = saved.map(item => {
        if (item && typeof item === 'object') {
          if (!item.videoUrl && item.src) { item.videoUrl = item.src; delete item.src; changed = true; }
          if (!('caption' in item) && item.title) { item.caption = item.title; changed = true; }
        }
        return item;
      });
      if (changed) localStorage.setItem(key, JSON.stringify(updated));
    } catch {}

    // Migrate old views (views:guest / views:{phone}) -> summary if you had any
    // Note: feed.js already writes to vsd:views:summary and vsd:views:perVideo
    // We’ll keep it simple: if legacy views exist and summary empty, write once.
    try {
      const legacyGuestViews = JSON.parse(localStorage.getItem('views:guest') || 'null');
      const legacyUserViews = phone ? JSON.parse(localStorage.getItem(`views:${phone}`) || 'null') : null;
      const summaryKey = 'vsd:views:summary';
      const summary = JSON.parse(localStorage.getItem(summaryKey) || 'null');
      if (!summary) {
        const src = legacyUserViews || legacyGuestViews;
        if (src && typeof src === 'object') {
          const obj = {
            lastDay: null,
            daily: src.daily || 0,
            seenToday: [],
            lastMonth: null,
            monthly: src.monthly || 0,
            seenThisMonth: []
          };
          localStorage.setItem(summaryKey, JSON.stringify(obj));
        }
      }
    } catch {}
  })();

  // Elements
  const loginBtn = document.getElementById('login-btn');
  const userArea = document.getElementById('user-area');
  const avatarEl = document.getElementById('avatar');
  const savedCount = document.getElementById('saved-count');
  const dailyCount = document.getElementById('daily-count');
  const monthlyCount = document.getElementById('monthly-count');
  const accountActions = document.getElementById('account-actions');
  const editProfileBtn = document.getElementById('edit-profile');
  const logoutBtn = document.getElementById('logout');
  const authCard = document.getElementById('auth-card');
  const authForm = document.getElementById('auth-form');
  const phoneInput = document.getElementById('phone');
  const nameInput = document.getElementById('name');
  const avatarInput = document.getElementById('avatar-input');
  const cancelAuth = document.getElementById('cancel-auth');
  const authError = document.getElementById('auth-error');
  const savedPreview = document.getElementById('saved-preview');
  const savedEmpty = document.getElementById('saved-empty');

  // Bottom nav
  document.getElementById('nav-home').onclick = () => (location.href = 'index.html');
  document.getElementById('nav-search').onclick = () => (location.href = 'search.html');
  document.getElementById('nav-add').onclick = () =>
    (location.href = 'https://docs.google.com/forms/d/e/1FAIpQLSd3zvLky2JWoa7Z5XmTS7gh2iUVnSgYYU_Hk14_01RuDsRMnw/viewform?usp=header');

  // Storage helpers (unified to vsd:* keys)
  const LS = {
    profilesKey: 'profiles',
    currentKey: 'currentUser',
    savedKey(phone) { return phone ? `vsd:saved:${phone}` : 'vsd:saved:guest'; },
    // views summary is global (as written by feed.js)
    viewsSummaryKey: 'vsd:views:summary',
    perVideoKey: 'vsd:views:perVideo',

    getProfiles() {
      return JSON.parse(localStorage.getItem(this.profilesKey) || '{}');
    },
    setProfiles(obj) {
      localStorage.setItem(this.profilesKey, JSON.stringify(obj));
    },
    getCurrentPhone() {
      return localStorage.getItem(this.currentKey) || null;
    },
    setCurrentPhone(phone) {
      if (phone) localStorage.setItem(this.currentKey, phone);
      else localStorage.removeItem(this.currentKey);
    },
    getSaved(phone) {
      return JSON.parse(localStorage.getItem(this.savedKey(phone)) || '[]');
    },
    setSaved(phone, arr) {
      localStorage.setItem(this.savedKey(phone), JSON.stringify(arr));
    },
    // Views summary (global daily/monthly uniques managed by feed.js)
    getViewsSummary() {
      return JSON.parse(localStorage.getItem(this.viewsSummaryKey) || 'null') || {
        lastDay: null, daily: 0, seenToday: [],
        lastMonth: null, monthly: 0, seenThisMonth: []
      };
    },
    getPerVideoViews() {
      return JSON.parse(localStorage.getItem(this.perVideoKey) || '{}');
    },
    setPerVideoViews(map) {
      localStorage.setItem(this.perVideoKey, JSON.stringify(map));
    }
  };

  // Toast
  function showToast(msg, type = 'success') {
    const t = document.createElement('div');
    t.className = `toast toast-${type === 'error' ? 'error' : 'success'}`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }

  // Migrate guest saved/views to user on first login (if user has none yet)
  function migrateGuestIfNeeded(phone) {
    const guest = LS.getSaved(null);
    const user = LS.getSaved(phone);
    if (user.length === 0 && guest.length > 0) {
      LS.setSaved(phone, guest);
    }
    // views summary is global (no per-user move needed)
  }

  // Profiles
  function getProfile(phone) {
    const profiles = LS.getProfiles();
    return profiles[phone] || null;
  }
  function upsertProfile({ phone, name, avatarData }) {
    const profiles = LS.getProfiles();
    const now = Date.now();
    const exists = profiles[phone];
    profiles[phone] = {
      phone,
      name,
      avatarData: avatarData ?? (exists ? exists.avatarData : null),
      createdAt: exists ? exists.createdAt : now,
      updatedAt: now
    };
    LS.setProfiles(profiles);
    return profiles[phone];
  }
  function isLoggedIn() {
    return !!LS.getCurrentPhone();
  }

  // Generate thumbnail from first frame of video
  // قبلی را حذف کن و این را بگذار
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
        const middleSec = video.duration / 3;
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
  async function ensureSavedThumb(item) {
  if (item.thumb) return { item, updated: false };
  const videoUrl = item.videoUrl || item.src || item.url;
  if (!videoUrl) return { item, updated: false };
  const thumb = await getMiddleFrameThumbnail(videoUrl); // تغییر همین خط
  if (thumb) {
    item.thumb = thumb;
    return { item, updated: true };
  }
  return { item, updated: false };
}

  // Public API for other pages (optional)
  function getStableId(raw) {
    return raw.id || raw.videoId || raw.slug || raw.url || raw.videoUrl || raw.src || String(Date.now());
  }
  async function saveVideo(raw) {
    const phone = LS.getCurrentPhone();
    const saved = LS.getSaved(phone);
    const id = getStableId(raw);
    if (saved.some(s => s.id === id)) { showToast('قبلاً ذخیره شده'); return; }
    const item = {
      id,
      title: raw.title || '',
      caption: raw.caption || raw.title || '',
      videoUrl: raw.videoUrl || raw.url || raw.src || '',
      thumb: raw.thumb || null
    };
    const { item: withThumb } = await ensureSavedThumb(item);
    saved.push(withThumb);
    LS.setSaved(phone, saved);
    renderStats();
    renderSavedPreview();
    showToast('ذخیره شد');
  }
  function unsaveVideo(id) {
    const phone = LS.getCurrentPhone();
    const next = LS.getSaved(phone).filter(s => s.id !== id);
    LS.setSaved(phone, next);
    renderStats();
    renderSavedPreview();
    showToast('از ذخیره‌ها حذف شد');
  }
  window.AppStorage = { LS, saveVideo, unsaveVideo };

  // UI: Header
  function renderHeader() {
    userArea.innerHTML = '';
    const phone = LS.getCurrentPhone();
    if (phone) {
      const profile = getProfile(phone);
      const name = profile?.name || 'کاربر';
      const info = document.createElement('div');
      info.style.display = 'flex';
      info.style.flexDirection = 'column';
      info.style.gap = '4px';
      info.innerHTML = `
        <strong style="font-size:15px;">${name}</strong>
        <span style="font-size:13px; color:#b0bec5;">${phone}</span>
      `;
      userArea.appendChild(info);
      accountActions.style.display = 'block';
      avatarEl.innerHTML = profile?.avatarData
        ? `<img src="${profile.avatarData}" alt="avatar" />`
        : `<i class="material-icons">person</i>`;
    } else {
      const btn = document.createElement('button');
      btn.id = 'login-btn';
      btn.textContent = 'ورود / ثبت‌نام';
      btn.className = 'input';
      btn.style.cssText = 'background:var(--accent); color:#fff; border:0; cursor:pointer;';
      btn.onclick = openAuthCard;
      userArea.appendChild(btn);
      accountActions.style.display = 'none';
      avatarEl.innerHTML = `<i class="material-icons">person</i>`;
    }
  }

  // Stats: read from vsd:views:summary (global unique views)
  function renderStats() {
    const phone = LS.getCurrentPhone();
    const saved = LS.getSaved(phone);
    savedCount.textContent = saved.length;

    const summary = LS.getViewsSummary();
    dailyCount.textContent = summary.daily || 0;
    monthlyCount.textContent = summary.monthly || 0;
  }

  // Saved preview grid
  async function renderSavedPreview() {
    const phone = LS.getCurrentPhone();
    const saved = LS.getSaved(phone);
    savedPreview.innerHTML = '';

    if (!saved.length) {
      savedEmpty.style.display = 'block';
      return;
    }
    savedEmpty.style.display = 'none';

    const list = saved.slice().reverse();
    let mutated = false;

    for (let i = 0; i < list.length; i++) {
      const item = { ...list[i] };

      if (!item.thumb && (item.videoUrl || item.url || item.src)) {
        const { item: upd, updated } = await ensureSavedThumb(item);
        if (updated) {
          // write back to original array (not reversed)
          const realIndex = saved.findIndex(s => s.id === item.id);
          if (realIndex > -1) { saved[realIndex] = upd; mutated = true; }
          list[i] = upd;
        }
      }

      const card = document.createElement('div');
      card.className = 'saved-item';
      const caption = item.caption || item.title || 'ویدیو';
      card.title = caption;

      const img = document.createElement('img');
      img.src = item.thumb || 'https://via.placeholder.com/160x285?text=No+Thumb';
      img.alt = caption;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      card.appendChild(img);

      card.addEventListener('click', () => {
        localStorage.setItem('openVideo', JSON.stringify(item));
        location.href = 'index.html';
      });

      savedPreview.appendChild(card);
    }

    if (mutated) {
      LS.setSaved(phone, saved);
    }
  }

  // Auth UI
  function openAuthCard(prefill = null) {
    authCard.classList.remove('hidden');
    authCard.setAttribute('aria-hidden', 'false');
    authError.style.display = 'none';
    authError.textContent = '';

    if (prefill) {
      phoneInput.value = prefill.phone || '';
      nameInput.value = prefill.name || '';
    } else {
      const phone = LS.getCurrentPhone();
      if (phone) {
        const p = getProfile(phone);
        phoneInput.value = p?.phone || '';
        nameInput.value = p?.name || '';
      } else {
        phoneInput.value = '';
        nameInput.value = '';
      }
    }
  }
  function closeAuthCard() {
    authCard.classList.add('hidden');
    authCard.setAttribute('aria-hidden', 'true');
    authForm.reset();
    authError.style.display = 'none';
    authError.textContent = '';
  }

  avatarEl.addEventListener('click', () => {
    if (!isLoggedIn()) { openAuthCard(); return; }
    openAuthCard(getProfile(LS.getCurrentPhone()));
    phoneInput.setAttribute('disabled', 'true');
  });
  editProfileBtn?.addEventListener('click', () => {
    const phone = LS.getCurrentPhone();
    if (!phone) return;
    openAuthCard(getProfile(phone));
    phoneInput.setAttribute('disabled', 'true');
  });
  logoutBtn?.addEventListener('click', () => {
    LS.setCurrentPhone(null);
    renderAll();
    showToast('از حساب خارج شدید');
  });

  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.style.display = 'none';
    authError.textContent = '';

    const phoneRaw = phoneInput.value.trim();
    const name = nameInput.value.trim();
    const phoneValid = /^0?9\d{9}$/.test(phoneRaw);
    if (!phoneValid) { authError.textContent = 'شماره تلفن معتبر نیست.'; authError.style.display = 'block'; return; }
    if (name.length < 2) { authError.textContent = 'نام را کامل وارد کنید.'; authError.style.display = 'block'; return; }

    let avatarData = null;
    if (avatarInput.files && avatarInput.files[0]) {
      try { avatarData = await fileToDataURL(avatarInput.files[0]); }
      catch { showToast('بارگذاری تصویر ناموفق بود', 'error'); }
    }

    const editing = phoneInput.hasAttribute('disabled');
    const phone = editing ? LS.getCurrentPhone() : phoneRaw;
    upsertProfile({ phone, name, avatarData });
    LS.setCurrentPhone(phone);
    migrateGuestIfNeeded(phone);
    renderAll();
    closeAuthCard();
    showToast(editing ? 'پروفایل به‌روزرسانی شد' : 'خوش آمدید!');
  });

  cancelAuth.addEventListener('click', () => { closeAuthCard(); });
  loginBtn?.addEventListener('click', openAuthCard);

  // Initial render
  function renderAll() {
    phoneInput.removeAttribute('disabled');
    renderHeader();
    renderStats();
    renderSavedPreview();
  }
  renderAll();
});