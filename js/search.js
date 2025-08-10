// File: js/search.js

document.addEventListener('DOMContentLoaded', () => {
  const results = document.getElementById('search-results');
  const input = document.getElementById('search-input');
  const keywordFromHash = new URLSearchParams(location.search).get("tag");
  let videos = [];

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
  // گرفتن فریم دلخواه از ویدیو
  // ---------------------------
  async function getMiddleFrameThumbnail(videoUrl, fraction = 1/3, fixedSec = null) {
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

          // اگر ثانیه مشخص داده شده باشد، همان استفاده می‌شود
          let seekTo = fixedSec !== null 
            ? Math.min(fixedSec, video.duration - 0.1) 
            : video.duration * fraction;

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

          try { video.currentTime = seekTo; } catch { resolve(null); }
        }, { once: true });
      } catch { resolve(null); }
    });
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
  // رندر کارت‌ها — فریم دلخواه
  // ---------------------------
  function renderGrid(arr) {
    results.innerHTML = '';
    arr.forEach(vid => {
      const card = document.createElement("div");
      card.className = "search-item";
      card.title = vid.caption || "ویدیو";

      const thumb = document.createElement("img");
      thumb.alt = vid.caption || "";
      thumb.style.width = "100%";
      thumb.style.height = "100%";
      thumb.style.objectFit = "cover";

      const videoUrl = vid.file || vid.videoUrl || vid.url || null;

      if (videoUrl) {
        const cached = ThumbCache.get(videoUrl);
        if (cached) {
          thumb.src = cached;
        } else {
          thumb.src = "https://via.placeholder.com/160x285?text=Loading...";

          // اینجا fraction رو تغییر بده؛ مثلا 1/3 یا حتی ثانیه ثابت
          getMiddleFrameThumbnail(videoUrl, 1/3 /* fraction */, null /* fixedSec */).then(t => {
            if (t) {
              ThumbCache.set(videoUrl, t);
              thumb.src = t;
            } else {
              thumb.src = "https://via.placeholder.com/160x285?text=No+Thumb";
            }
          });
        }
      } else {
        thumb.src = "https://via.placeholder.com/160x285?text=No+Video";
      }

      card.appendChild(thumb);

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
});