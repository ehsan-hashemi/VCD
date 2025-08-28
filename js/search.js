// File: js/search.js

document.addEventListener('DOMContentLoaded', () => {
  const results = document.getElementById('search-results');
  const input = document.getElementById('search-input');
  const keywordFromHash = new URLSearchParams(location.search).get("tag");
  let videos = [];

  ensureSpinnerStyles(); // همان استایل اسپینر ویدیو در فید، برای سرچ هم تزریق می‌شود

  // ---------------------------
  // کش Thumbnail در localStorage
  // ---------------------------
  const TH_CACHE_KEY = 'vsd:thumbs';
  const ThumbCache = {
    get(u) {
      try {
        return JSON.parse(localStorage.getItem(TH_CACHE_KEY) || '{}')[u] || null;
      } catch { return null; }
    },
    set(u, data) {
      try {
        const m = JSON.parse(localStorage.getItem(TH_CACHE_KEY) || '{}');
        m[u] = data;
        localStorage.setItem(TH_CACHE_KEY, JSON.stringify(m));
      } catch {}
    }
  };

  // ---------------------------
  // گرفتن فریم از 1/3 ویدیو (هماهنگ با فید)
  // ---------------------------
  async function getMiddleFrameThumbnail(videoUrl) {
    return new Promise((resolve) => {
      try {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.preload = 'metadata';
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
            try {
              const canvas = document.createElement('canvas');
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const url = canvas.toDataURL('image/jpeg', 0.75);
              resolve(url || null);
            } catch { resolve(null); }
          };
          video.addEventListener('seeked', onSeeked, { once: true });
          try { video.currentTime = middleSec; } catch { resolve(null); }
        }, { once: true });
      } catch { resolve(null); }
    });
  }

  // ---------------------------
  // گرفتن یا ساخت thumbnail
  // ---------------------------
  async function ensureSearchThumb(videoUrl) {
    let thumb = ThumbCache.get(videoUrl);
    if (!thumb) {
      thumb = await getMiddleFrameThumbnail(videoUrl);
      if (thumb) ThumbCache.set(videoUrl, thumb);
    }
    return thumb;
  }

  // ---------------------------
  // وضعیت آنلاین/آفلاین
  // ---------------------------
  function updateOnlineStatus() {
    const banner = document.getElementById("offline-banner");
    if (!banner) return;
    banner.classList.toggle("hidden", navigator.onLine);
  }
  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);
  updateOnlineStatus();

  // ---------------------------
  // دریافت لیست ویدیوها
  // ---------------------------
  fetch("data/videos.json")
    .then(res => {
      if (!res.ok) throw new Error("ویدیوها دریافت نشد");
      return res.json();
    })
    .then(data => {
      videos = data.sort((a, b) => b.id - a.id);
      if (keywordFromHash) {
        input.value = keywordFromHash;
        searchAndRender(keywordFromHash);
      } else {
        renderGrid(videos);
      }
    })
    .catch(err => {
      console.error(err);
      results.innerHTML = `<p style="text-align:center; color:#ff6f60">خطا در بارگذاری ویدیوها</p>`;
    });

  // ---------------------------
  // سرچ
  // ---------------------------
  input.addEventListener("input", () => {
    const term = input.value.trim();
    if (!term) renderGrid(videos);
    else searchAndRender(term);
  });

  function searchAndRender(term) {
    const kw = term.toLowerCase();
    const matched = videos
      .map(v => {
        const caption = (v.caption || "").toLowerCase();
        const index = caption.indexOf(kw);
        const tags = [...caption.match(/#(\S+)/g) || []];
        const hasTag = tags.some(t => t.replace("#", "").toLowerCase() === kw);
        const rank = hasTag ? -1 : index;
        return rank >= 0 || hasTag
          ? { ...v, matchRank: rank }
          : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.matchRank - b.matchRank);

    if (matched.length) renderGrid(matched);
    else results.innerHTML = `<p style="text-align:center; color:#90a4ae">هیچ ویدیویی یافت نشد</p>`;
  }

  // ---------------------------
  // رندر کارت‌ها + اسپینر «مثل ویدئوها» هنگام ساخت بندانگشتی
  // ---------------------------
  function renderGrid(arr) {
    results.innerHTML = '';
    arr.forEach(vid => {
      const card = document.createElement("div");
      card.className = "search-item";
      card.title = vid.caption || "ویدیو";

      // اسپینر همان کلاس فید (video-spinner)
      const spinner = document.createElement('div');
      spinner.className = 'video-spinner show';
      spinner.innerHTML = `<div class="ring"></div>`;

      // تصویر بندانگشتی (جلوگیری از نمایش متن کپشن به‌عنوان fallback)
      const thumb = document.createElement("img");
      thumb.alt = "";            // جلوگیری از نمایش متن
      thumb.decoding = "async";
      thumb.loading = "lazy";
      thumb.style.width = "100%";
      thumb.style.height = "100%";
      thumb.style.objectFit = "cover";

      // یک پیکسل شفاف برای شروع
      const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
      thumb.src = BLANK;

      const videoUrl = vid.file || vid.videoUrl || vid.url || null;

      const finish = () => spinner.classList.remove('show');
      thumb.addEventListener('load', finish, { once: true });
      thumb.addEventListener('error', finish, { once: true });

      if (videoUrl) {
        ensureSearchThumb(videoUrl).then(t => {
          if (t) {
            thumb.src = t; // dataURL
            if (vid.caption) thumb.alt = vid.caption; // فقط برای دسترس‌پذیری
          } else {
            // شکست ساخت بندانگشتی: اسپینر خاموش و کارت سیاه می‌ماند
            spinner.classList.remove('show');
            // thumb.src = BLANK; // کافی است
          }
        });
      } else {
        spinner.classList.remove('show');
      }

      card.appendChild(thumb);
      card.appendChild(spinner);

      card.addEventListener("click", () => {
        localStorage.setItem("openVideo", JSON.stringify(vid));
        location.href = "index.html";
      });

      results.appendChild(card);
    });
  }

  // ---------------------------
  // ناوبری پایین
  // ---------------------------
  document.getElementById('nav-home').onclick = () => location.href = 'index.html';
  document.getElementById('nav-settings').onclick = () => location.href = 'settings.html';
  document.getElementById('nav-add').onclick = () => {
    location.href = 'https://docs.google.com/forms/d/e/1FAIpQLSd3zvLky2JWoa7Z5XmTS7gh2iUVnSgYYU_Hk14_01RuDsRMnw/viewform?usp=header';
  };

  // ---------------------------
  // استایل‌های اسپینر (هماهنگ با فید)
  // ---------------------------
  function ensureSpinnerStyles() {
    if (document.getElementById('vsd-spinner-inline')) return;
    const css = `
      .video-spinner{
        position:absolute; inset:0;
        display:flex; align-items:center; justify-content:center;
        opacity:0; transition:opacity .2s ease;
        pointer-events:none;
        background: rgba(0,0,0,0.25);
      }
      .video-spinner.show{ opacity:1; }
      .video-spinner .ring{
        width:48px; height:48px;
        border:3px solid rgba(255,255,255,0.35);
        border-top-color:#fff;
        border-radius:50%;
        animation: vsd-spin 1s linear infinite;
      }
      @keyframes vsd-spin { to { transform: rotate(360deg); } }
    `;
    const style = document.createElement('style');
    style.id = 'vsd-spinner-inline';
    style.textContent = css;
    document.head.appendChild(style);
  }
});