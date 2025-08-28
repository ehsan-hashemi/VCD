// js/schema-generator.js
(function () {
  const SITE = 'https://vcdplay.ir';
  const THUMB = id => `${SITE}/thumbs/${encodeURIComponent(id)}.jpg`;
  const BRAND = { name: 'VCD', aliases: ['وی سی دی','وی سی دی پلی','vcd','vcdplay'] };

  const clean = t => (t||'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
  const summarize = (t,n) => {
    const s=clean(t); if(s.length<=n) return s;
    const cut=s.slice(0,n);
    const last=Math.max(cut.lastIndexOf('. '),cut.lastIndexOf('، '),cut.lastIndexOf(' '));
    return (last>24?cut.slice(0,last):cut)+'…';
  };
  const inject = obj => { const el=document.createElement('script'); el.type='application/ld+json'; el.textContent=JSON.stringify(obj); document.head.appendChild(el); };

  inject({ '@context':'https://schema.org','@type':'Organization','name':BRAND.name,'alternateName':BRAND.aliases,'url':SITE });
  inject({
    '@context':'https://schema.org','@type':'WebSite','name':BRAND.name,'alternateName':BRAND.aliases,'url':SITE,
    'potentialAction':{'@type':'SearchAction','target':`${SITE}/search.html?q={search_term_string}`,'query-input':'required name=search_term_string'}
  });

  fetch('data/videos.json')
    .then(r=>r.json())
    .then(list=>{
      if(!Array.isArray(list)||!list.length) return;
      const graph=list.map(v=>{
        const id=v.id, caption=v.caption||'';
        const name=summarize(caption,70)||'ویدئوی کوتاه VCD';
        const description=summarize(caption,180)||'ویدئوی کوتاه در VCD';
        const contentUrl = v.file.startsWith('http') ? v.file : `${SITE}/${v.file.replace(/^\/+/, '')}`;
        const embedUrl = `${SITE}/index.html#v=${encodeURIComponent(id)}`;
        const keywords = Array.from(new Set([
          ...clean(caption).toLowerCase().split(/\s+/).filter(Boolean),
          ...BRAND.aliases.map(x=>x.toLowerCase()),
          BRAND.name.toLowerCase()
        ])).join(', ');
        return {
          '@context':'https://schema.org','@type':'VideoObject',
          name, description, thumbnailUrl:[THUMB(id)], contentUrl, embedUrl,
          publisher:{'@type':'Organization','name':BRAND.name},
          keywords,
          potentialAction:[
            {'@type':'WatchAction','target':embedUrl},
            {'@type':'SeekToAction','target':`${embedUrl}&t={seek_to_second_number}`,'startOffset-input':'required name=seek_to_second_number'}
          ]
        };
      });
      inject(graph);
    })
    .catch(()=>{});
})();