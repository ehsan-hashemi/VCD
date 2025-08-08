document.addEventListener('DOMContentLoaded', () => {
  fetch('data/videos.json')
    .then(res => res.json())
    .then(data => renderGrid(data))
    .catch(err => console.error(err));
});

function renderGrid(videos) {
  const container = document.getElementById('search-results');
  container.innerHTML = '';
  
  videos
    .sort((a,b) => b.id - a.id)
    .forEach(vid => {
      const item = document.createElement('div');
      item.className = 'search-item';
      // می‌توانید thumbnail استفاده کنید؛ یا خود ویدیو را preload کنید
      const thumb = document.createElement('img');
      thumb.src = vid.thumbnail; // اگر thumbnail دارید
      item.appendChild(thumb);

      item.onclick = () => {
        location.href = `feed.html#v=${vid.id}`;
      };
      container.appendChild(item);
    });
}