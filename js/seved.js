// js/seved.js

/**
 * واکشی و نمایش ویدیوهای ذخیره‌شده
 */
document.addEventListener('DOMContentLoaded', () => {
  const savedContainer = document.getElementById('saved-videos');

  const phone = localStorage.getItem('currentUser');
  const saved = JSON.parse(localStorage.getItem(phone ? `saved:${phone}` : 'saved:guest') || '[]');

  if (!saved.length) {
    savedContainer.innerHTML = '<p style="color:#90a4ae; text-align:center;">ویدیویی ذخیره نشده.</p>';
    return;
  }

  saved.reverse().forEach(item => {
    const div = document.createElement('div');
    div.className = 'saved-item';
    div.title = item.title || 'ویدیو';
    div.innerHTML = item.thumb
      ? `<img src="${item.thumb}" alt="${item.title || ''}" />`
      : `<div style="background:#1c1c1c; height:160px;"></div>`;
    div.onclick = () => {
      localStorage.setItem('openVideo', JSON.stringify(item));
      location.href = 'index.html';
    };
    savedContainer.appendChild(div);
  });
});

