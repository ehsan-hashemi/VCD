// File: js/settings.js
document.addEventListener('DOMContentLoaded', () => {
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

  // Navigation
  document.getElementById('nav-home').onclick = () => (location.href = 'index.html');
  document.getElementById('nav-search').onclick = () => (location.href = 'search.html');
  document.getElementById('nav-add').onclick = () =>
    (location.href = 'https://docs.google.com/forms/d/e/1FAIpQLSd3zvLky2JWoa7Z5XmTS7gh2iUVnSgYYU_Hk14_01RuDsRMnw/viewform?usp=header');

  // Storage helpers
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
    const userSaved = LS.getSaved(phone);
    const guestSaved = LS.getSaved(null);
    if (userSaved.length === 0 && guestSaved.length > 0) {
      LS.setSaved(phone, guestSaved);
    }
    const userViews = LS.getViews(phone);
    const guestViews = LS.getViews(null);
    if ((userViews.daily || userViews.monthly) === 0 && (guestViews.daily || guestViews.monthly)) {
      LS.setViews(phone, guestViews);
    }
  }

  // Profile helpers
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

  // UI render
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
      // Avatar
      if (profile?.avatarData) {
        avatarEl.innerHTML = `<img src="${profile.avatarData}" alt="avatar" />`;
      } else {
        avatarEl.innerHTML = `<i class="material-icons">person</i>`;
      }
    } else {
      // Logged out
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

  function cardFromItem(item) {
    const el = document.createElement('div');
    el.className = 'saved-item';
    el.title = item.title || 'ویدیو';
    const thumb = item.thumb || '';
    if (thumb) {
      el.innerHTML = `<img src="${thumb}" alt="${item.title || ''}"/>`;
    } else {
      el.style.background = 'linear-gradient(135deg, #0f0f0f, #1c1c1c)';
      el.innerHTML = '';
    }
    el.addEventListener('click', () => openVideo(item));
    return el;
  }

  function renderSavedPreview() {
    const phone = LS.getCurrentPhone();
    const saved = LS.getSaved(phone);
    savedPreview.innerHTML = '';
    if (!saved.length) {
      savedEmpty.style.display = 'block';
      return;
    }
    savedEmpty.style.display = 'none';
    // recent 9
    saved.slice(-9).reverse().forEach(v => {
      savedPreview.appendChild(cardFromItem(v));
    });
  }

  // Open video in viewer (index.html) by intent
  function openVideo(item) {
    localStorage.setItem('openVideo', JSON.stringify(item));
    location.href = 'index.html';
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
      // If profile exists by current phone, prefill
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

  // Avatar click -> open file picker (only if logged in, else open auth)
  avatarEl.addEventListener('click', () => {
    if (!isLoggedIn()) {
      openAuthCard();
      return;
    }
    // shortcut: open edit profile flow
    openAuthCard(getProfile(LS.getCurrentPhone()));
    // phone cannot be edited
    phoneInput.setAttribute('disabled', 'true');
  });

  // Edit profile button
  editProfileBtn?.addEventListener('click', () => {
    const phone = LS.getCurrentPhone();
    if (!phone) return;
    openAuthCard(getProfile(phone));
    phoneInput.setAttribute('disabled', 'true'); // شماره کلید حساب است
  });

  // Logout
  logoutBtn?.addEventListener('click', () => {
    LS.setCurrentPhone(null); // حذف سشن، بدون حذف داده‌ها
    renderAll();
    showToast('از حساب خارج شدید');
  });

  // Read file to dataURL
  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  // Auth submit
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.style.display = 'none';
    authError.textContent = '';

    const phoneRaw = phoneInput.value.trim();
    const name = nameInput.value.trim();

    // normalize phone (keep as entered for display; but validation simple)
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

    // If editing, phoneInput may be disabled: use current phone
    const editing = phoneInput.hasAttribute('disabled');
    const phone = editing ? LS.getCurrentPhone() : phoneRaw;

    // Upsert profile
    const profile = upsertProfile({ phone, name, avatarData });
    // Set current session
    LS.setCurrentPhone(phone);

    // Migrate guest data once
    migrateGuestIfNeeded(phone);

    renderAll();
    closeAuthCard();
    showToast(editing ? 'پروفایل به‌روزرسانی شد' : 'خوش آمدید!');
  });

  // Cancel auth
  cancelAuth.addEventListener('click', () => {
    closeAuthCard();
  });

  // Login button (when logged out)
  loginBtn?.addEventListener('click', openAuthCard);

  // Initial render
  function renderAll() {
    // In case phone input remained disabled from edit flow
    phoneInput.removeAttribute('disabled');
    renderHeader();
    renderStats();
    renderSavedPreview();
  }
  renderAll();
});