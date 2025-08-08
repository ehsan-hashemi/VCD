// File: js/settings.js
document.addEventListener('DOMContentLoaded', () => {
  // عناصر صفحه و فرم‌ها
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

  // ناوبری
  document.getElementById('nav-home').onclick = () => (location.href = 'index.html');
  document.getElementById('nav-search').onclick = () => (location.href = 'search.html');
  document.getElementById('nav-add').onclick = () =>
    (location.href = 'https://docs.google.com/forms/d/e/1FAIpQLSd3zvLky2JWoa7Z5XmTS7gh2iUVnSgYYU_Hk14_01RuDsRMnw/viewform?usp=header');

  // ذخیره‌سازی محلی
  const LS = {
    getProfiles() {
      return JSON.parse(localStorage.getItem('profiles') || '{}');
    },
    setProfiles(obj) {
      localStorage.setItem('profiles', JSON.stringify(obj));
    },
    getCurrentPhone() {
      return localStorage.getItem('currentUser') || null;
    },
    setCurrentPhone(phone) {
      if (phone) localStorage.setItem('currentUser', phone);
      else localStorage.removeItem('currentUser');
    },
    getSaved(phone) {
      if (!phone) return JSON.parse(localStorage.getItem('saved:guest') || '[]');
      return JSON.parse(localStorage.getItem(`saved:${phone}`) || '[]');
    },
    setSaved(phone, arr) {
      if (!phone) localStorage.setItem('saved:guest', JSON.stringify(arr));
      else localStorage.setItem(`saved:${phone}`, JSON.stringify(arr));
    },
    getViews(phone) {
      const key = phone ? `views:${phone}` : 'views:guest';
      return JSON.parse(localStorage.getItem(key) || '{"daily":0,"monthly":0}');
    },
    setViews(phone, obj) {
      const key = phone ? `views:${phone}` : 'views:guest';
      localStorage.setItem(key, JSON.stringify(obj));
    }
  };

  // پیام کوچک
  function showToast(msg, type = 'success') {
    const t = document.createElement('div');
    t.className = `toast toast-${type === 'error' ? 'error' : 'success'}`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }

  // مهاجرت اطلاعات مهمان به کاربر
  function migrateGuestIfNeeded(phone) {
    const userSaved = LS.getSaved(phone);
    const guestSaved = LS.getSaved(null);
    if (userSaved.length === 0 && guestSaved.length > 0) {
      LS.setSaved(phone, guestSaved);
    }

    const userViews = LS.getViews(phone);
    const guestViews = LS.getViews(null);
    const userTotal = (userViews.daily || 0) + (userViews.monthly || 0);
    const guestTotal = (guestViews.daily || 0) + (guestViews.monthly || 0);
    if (userTotal === 0 && guestTotal > 0) {
      LS.setViews(phone, guestViews);
    }
  }

  // پروفایل
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

  // تولید thumbnail از اولین فریم ویدیو
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
          const seekTo = Math.min(Math.max(atSec, 0), (video.duration || 1) - 0.01);
          const seek = () => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            try {
              const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
              resolve(dataUrl);
            } catch {
              resolve(null);
            }
          };
          video.addEventListener('seeked', () => seek(), { once: true });
          try { video.currentTime = seekTo; } catch { resolve(null); }
        }, { once: true });
      } catch {
        resolve(null);
      }
    });
  }

  async function ensureSavedThumb(item) {
    if (item.thumb) return { item, updated: false };
    const videoUrl = item.videoUrl || item.src || item.url;
    if (!videoUrl) return { item, updated: false };
    const thumb = await getFirstFrameThumbnail(videoUrl);
    if (thumb) {
      item.thumb = thumb;
      return { item, updated: true };
    }
    return { item, updated: false };
  }

  function getStableId(raw) {
    return raw.id || raw.videoId || raw.slug || raw.url || raw.videoUrl || raw.src || String(Date.now());
  }

  async function saveVideo(raw) {
    const phone = LS.getCurrentPhone();
    const saved = LS.getSaved(phone);

    const id = getStableId(raw);
    if (saved.some(s => s.id === id)) {
      showToast('قبلا ذخیره شده');
      return;
    }

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
    const saved = LS.getSaved(phone);
    const next = saved.filter(s => s.id !== id);
    LS.setSaved(phone, next);
    renderStats();
    renderSavedPreview();
    showToast('از ذخیره‌ها حذف شد');
  }

  window.AppStorage = { LS, saveVideo, unsaveVideo };

  // UI
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
      if (profile?.avatarData) {
        avatarEl.innerHTML = `<img src="${profile.avatarData}" alt="avatar" />`;
      } else {
        avatarEl.innerHTML = `<i class="material-icons">person</i>`;
      }
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

  function renderStats() {
    const phone = LS.getCurrentPhone();
    const saved = LS.getSaved(phone);
    savedCount.textContent = saved.length;

    const views = LS.getViews(phone);
    dailyCount.textContent = views.daily || 0;
    monthlyCount.textContent = views.monthly || 0;
  }

  async function renderSavedPreview() {
    const phone = LS.getCurrentPhone();
    const saved = LS.getSaved(phone);
    savedPreview.innerHTML = '';

    if (!saved.length) {
      savedEmpty.style.display = 'block';
      return;
    }
    savedEmpty.style.display = 'none';

    const cloned = saved.slice().reverse();
    let mutated = false;

    for (let i = 0; i < cloned.length; i++) {
      const item = { ...cloned[i] };
      if (!item.thumb && (item.videoUrl || item.src || item.url)) {
        const { item: updatedItem, updated } = await ensureSavedThumb(item);
        if (updated) {
          const realIndex = saved.findIndex(s => s.id === item.id);
          if (realIndex > -1) {
            saved[realIndex] = updatedItem;
            mutated = true;
          }
          cloned[i] = updatedItem;
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

  function openVideo(item) {
    localStorage.setItem('openVideo', JSON.stringify(item));
    location.href = 'index.html';
  }

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
    if (!isLoggedIn()) {
      openAuthCard();
      return;
    }
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
    if (!phoneValid) {
      authError.textContent = 'شماره تلفن معتبر نیست.';
      authError.style.display = 'block';
      return;
    }
    if (name.length < 2) {
      authError.textContent = 'نام را کامل وارد کنید.';
      authError.style.display = 'block';
      return;
    }

    let avatarData = null;
    if (avatarInput.files && avatarInput.files[0]) {
      try {
        avatarData = await fileToDataURL(avatarInput.files[0]);
      } catch {
        showToast('بارگذاری تصویر ناموفق بود', 'error');
      }
    }

    const editing = phoneInput.hasAttribute('disabled');
    const phone = editing ? LS.getCurrentPhone() : phoneRaw;
    const profile = upsertProfile({ phone, name, avatarData });
    LS.setCurrentPhone(phone);
    migrateGuestIfNeeded(phone);
    renderAll();
    closeAuthCard();
    showToast(editing ? 'پروفایل به‌روزرسانی شد' : 'خوش آمدید!');
  });

  cancelAuth.addEventListener('click', () => {
    closeAuthCard();
  });

  loginBtn?.addEventListener('click', openAuthCard);

  function renderAll() {
    phoneInput.removeAttribute('disabled');
    renderHeader();
    renderStats();
    renderSavedPreview();
  }

  renderAll();
});