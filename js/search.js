// File: js/search.js

document.addEventListener('DOMContentLoaded', () => {
  const results = document.getElementById('search-results');
  const input = document.getElementById('search-input');
  const keywordFromHash = new URLSearchParams(location.search).get("tag");
  let videos = [];

  function updateOnlineStatus() {
    const banner = document.getElementById("offline-banner");
    if (!banner) return;
    banner.classList.toggle("hidden", navigator.onLine);
  }
  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);
  updateOnlineStatus();

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

  function renderGrid(arr) {
    results.innerHTML = '';
    arr.forEach(vid => {
      const card = document.createElement("div");
      card.className = "search-item";
      card.title = vid.caption || "ویدیو";

      const thumb = document.createElement("img");
      thumb.src = vid.thumbnail || vid.thumb || "https://via.placeholder.com/160x285?text=No+Thumb";
      thumb.alt = vid.caption || "";
      thumb.style.width = "100%";
      thumb.style.height = "100%";
      thumb.style.objectFit = "cover";
      card.appendChild(thumb);

      card.addEventListener("click", () => {
        localStorage.setItem("openVideo", JSON.stringify(vid));
        location.href = "index.html";
      });

      results.appendChild(card);
    });
  }

  // ناوبری پایین
  document.getElementById('nav-home').onclick = () => location.href = 'index.html';
  document.getElementById('nav-settings').onclick = () => location.href = 'settings.html';
  document.getElementById('nav-add').onclick = () => {
    location.href = 'https://docs.google.com/forms/d/e/1FAIpQLSd3zvLky2JWoa7Z5XmTS7gh2iUVnSgYYU_Hk14_01RuDsRMnw/viewform?usp=header';
  };
});