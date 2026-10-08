// Çevrimdışı önbellek: hacizde internet olmasa da uygulama açılıp hesaplama yapılabilsin.
// - Uygulama sayfası önce ağdan istenir (güncellemeler hemen gelsin), ağ yoksa önbellekten açılır.
// - Kütüphaneler (Tailwind, docx, Supabase, Tesseract, yazı tipi) önbellekten verilir, arkada yenilenir.
// - Supabase istekleri (giriş, taslaklar) asla önbelleğe alınmaz.
const ONBELLEK = 'taahhut-v1';

const SAYFALAR = [
    './',
    './index.html',
    './Taahh%C3%BCt%20Hesaplay%C4%B1c%C4%B1.html'
];

const KUTUPHANELER = [
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/docx@7.8.2/build/index.js',
    'https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js',
    'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/dist/umd/supabase.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

self.addEventListener('install', (olay) => {
    olay.waitUntil((async () => {
        const onbellek = await caches.open(ONBELLEK);
        await onbellek.addAll(SAYFALAR);
        // Kütüphaneler başka sunuculardan, <script> etiketiyle CORS'suz yüklenir; aynı biçimde istenip saklanır.
        await Promise.all(KUTUPHANELER.map(async (adres) => {
            try {
                const yanit = await fetch(new Request(adres, { mode: 'no-cors' }));
                await onbellek.put(adres, yanit);
            } catch (hata) {
                console.warn('Önbelleğe alınamadı:', adres, hata);
            }
        }));
        self.skipWaiting();
    })());
});

self.addEventListener('activate', (olay) => {
    olay.waitUntil((async () => {
        const adlar = await caches.keys();
        await Promise.all(adlar.filter(ad => ad !== ONBELLEK).map(ad => caches.delete(ad)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (olay) => {
    const istek = olay.request;
    if (istek.method !== 'GET') return;
    const adres = new URL(istek.url);
    if (adres.hostname.endsWith('.supabase.co')) return;

    if (adres.origin === self.location.origin) {
        olay.respondWith(agOncelikli(istek));
    } else {
        olay.respondWith(onbellekOncelikli(istek, olay));
    }
});

async function agOncelikli(istek) {
    const onbellek = await caches.open(ONBELLEK);
    try {
        const yanit = await fetch(istek);
        if (yanit.ok) onbellek.put(istek, yanit.clone());
        return yanit;
    } catch (hata) {
        const kayitli = await onbellek.match(istek, { ignoreSearch: true });
        if (kayitli) return kayitli;
        throw hata;
    }
}

async function onbellekOncelikli(istek, olay) {
    const onbellek = await caches.open(ONBELLEK);
    const kayitli = await onbellek.match(istek);
    const yenile = fetch(istek).then(yanit => {
        if (yanit.ok || yanit.type === 'opaque') onbellek.put(istek, yanit.clone());
        return yanit;
    });
    if (kayitli) {
        olay.waitUntil(yenile.catch(() => {}));
        return kayitli;
    }
    return yenile;
}
