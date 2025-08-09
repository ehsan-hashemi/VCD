// File: js/seved.js
document.addEventListener("DOMContentLoaded", () => {
  (function migrateSavedStructure(){
    const phone = localStorage.getItem("currentUser");
    const key = phone ? `saved:${phone}` : "saved:guest";
    const saved = JSON.parse(localStorage.getItem(key) || "[]");
    let changed = false;
    const updated = saved.map(item => {
      if (!item.videoUrl && item.src) { 
        item.videoUrl = item.src;
        delete item.src;
        changed = true;
      }
      return item;
    });
    if (changed) {
      localStorage.setItem(key, JSON.stringify(updated));
    }
  })();
  const container = document.getElementById("saved-list");
  const phone = localStorage.getItem("currentUser");
  const key = phone ? `saved:${phone}` : "saved:guest";

  const saved = JSON.parse(localStorage.getItem(key) || "[]");
  if (!saved.length) {
    container.innerHTML = `<p style="text-align:center; color:#9e9e9e; font-size:15px;">هنوز هیچ ویدیویی ذخیره نشده 😶</p>`;
    return;
  }

  saved.reverse().forEach(item => {
    const div = document.createElement("div");
    div.className = "saved-item";
    div.title = item.caption || "ویدیو ذخیره‌شده";

    const thumb = document.createElement("img");
    thumb.src = item.thumb || "https://via.placeholder.com/160x285?text=No+Thumb";
    thumb.alt = "thumbnail";
    thumb.style.width = "100%";
    thumb.style.height = "100%";
    thumb.style.objectFit = "cover";
    div.appendChild(thumb);

    div.addEventListener("click", () => {
      localStorage.setItem("openVideo", JSON.stringify(item));
      location.href = "index.html";
    });

    container.appendChild(div);
  });
  document.getElementById('nav-home').onclick = () => location.href = 'index.html';
  document.getElementById('nav-search').onclick = () => location.href = 'search.html';
  document.getElementById('nav-add').onclick = () => {
    location.href = 'https://docs.google.com/forms/d/e/1FAIpQLSd3zvLky2JWoa7Z5XmTS7gh2iUVnSgYYU_Hk14_01RuDsRMnw/viewform?usp=header';
  };
  document.getElementById('nav-settings').onclick = () => location.href = 'settings.html';
});