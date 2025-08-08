// js/seved.js

/**
 * واکشی و نمایش ویدیوهای ذخیره‌شده
 */
document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("saved-list");
  const phone = localStorage.getItem("currentUser");
  const key = phone ? `saved:${phone}` : "saved:guest";
  const saved = JSON.parse(localStorage.getItem(key) || "[]");

  if (!saved.length) {
    container.innerHTML = `<div class="empty-saved">ویدیویی ذخیره نشده است 😶</div>`;
    return;
  }

  saved.forEach(vid => {
    const card = document.createElement("div");
    card.className = "video-card";

    // پیش‌نمایش ویدیو
    const video = document.createElement("video");
    video.src = vid.src;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.autoplay = true;
    video.className = "video-thumb";
    card.appendChild(video);

    // کپشن
    const caption = document.createElement("div");
    caption.className = "caption-text";
    caption.innerHTML = vid.caption || "";
    card.appendChild(caption);

    // دکمه حذف
    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-button";
    removeBtn.innerHTML = `<span class="material-icons">delete</span>`;
    removeBtn.title = "حذف از ذخیره‌ها";
    removeBtn.onclick = () => {
      const updated = saved.filter(x => x.id !== vid.id);
      localStorage.setItem(key, JSON.stringify(updated));
      location.reload();
    };
    card.appendChild(removeBtn);

    // کلیک روی کارت برای باز کردن ویدیو
    card.addEventListener("click", e => {
      if (e.target.tagName === "BUTTON" || e.target.closest("button")) return;
      localStorage.setItem("openVideo", JSON.stringify(vid));
      location.href = "index.html";
    });

    container.appendChild(card);
  });
});
