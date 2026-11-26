/**
 * Si Perbaiki - Profil Admin
 * Fitur: edit informasi pribadi (validasi + simpan/batal), sinkronisasi banner,
 * ganti & unduh foto profil, riwayat aktivitas (Lihat Semua), pencarian kartu,
 * toast notifikasi, dan penyimpanan data (localStorage).
 *
 * Pada HTML sudah terpasang: <script src="profil-admin.js"></script>
 */
document.addEventListener('DOMContentLoaded', () => {
    // ===== KONFIGURASI =====
    const STORAGE_KEY = 'siperbaiki_profil_admin';
    const MAX_AVATAR_MB = 1;
    const MAX_RECENT = 3; // jumlah aktivitas di kartu "Aktivitas Terakhir"

    // ===== UTIL =====
    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
    const escapeHTML = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const MONTHS = {
        januari: 0, january: 0, februari: 1, february: 1, maret: 2, march: 2, april: 3,
        mei: 4, may: 4, juni: 5, june: 5, juli: 6, july: 6, agustus: 7, august: 7,
        september: 8, oktober: 9, october: 9, november: 10, desember: 11, december: 11,
    };
    const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const pad = (n) => String(n).padStart(2, '0');
    const formatDate = (d) => `${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()} (${pad(d.getHours())}:${pad(d.getMinutes())} WIB)`;

    // Ubah "22 November 2026 (08:00 WIB)" menjadi objek Date
    function parseDate(text) {
        const m = text.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s*\((\d{2}):(\d{2})/);
        if (!m || MONTHS[m[2].toLowerCase()] === undefined) return new Date(0);
        return new Date(+m[3], MONTHS[m[2].toLowerCase()], +m[1], +m[4], +m[5]);
    }

    // ===== STYLE TAMBAHAN (toast, modal, mode edit) =====
    const style = document.createElement('style');
    style.textContent = `
        .pa-toast-wrap{position:fixed;right:20px;bottom:20px;display:flex;flex-direction:column;gap:8px;z-index:9999}
        .pa-toast{background:#1f2937;color:#fff;padding:10px 16px;border-radius:8px;font-size:13px;
            box-shadow:0 4px 14px rgba(0,0,0,.2);opacity:0;transform:translateY(8px);transition:.25s}
        .pa-toast.show{opacity:1;transform:none}
        .pa-toast.error{background:#b91c1c}
        .pa-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;
            justify-content:center;z-index:9998;padding:16px}
        .pa-modal{background:#fff;color:#111827;width:100%;max-width:480px;max-height:85vh;overflow:auto;
            border-radius:12px;padding:22px;box-shadow:0 10px 30px rgba(0,0,0,.25)}
        .pa-modal h3{margin:0 0 12px;font-size:18px}
        .pa-log{list-style:none;margin:0;padding:0}
        .pa-log li{padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:14px;display:flex;
            justify-content:space-between;gap:12px}
        .pa-log li:last-child{border-bottom:0}
        .pa-log small{color:#6b7280;white-space:nowrap}
        .pa-close{margin-top:14px;float:right;padding:8px 16px;border-radius:6px;border:1px solid #d1d5db;
            background:#fff;cursor:pointer;font-size:13px}
        .pa-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}
        .pa-btn{padding:8px 18px;border-radius:6px;border:1px solid #0891b2;background:#fff;color:#0891b2;
            cursor:pointer;font-size:13px}
        .pa-btn.primary{background:#0891b2;color:#fff}
        .pa-edit-input{width:100%;padding:6px 8px;border:1px solid #0891b2;border-radius:6px;font:inherit;
            box-sizing:border-box;background:#fff;color:#111827}
        .pa-edit-input.invalid{border-color:#b91c1c}
        .pa-field-error{color:#b91c1c;font-size:11px;margin-top:3px}
        .banner-avatar-circle{cursor:pointer}
    `;
    document.head.appendChild(style);

    // ===== TOAST & MODAL =====
    const toastWrap = Object.assign(document.createElement('div'), { className: 'pa-toast-wrap' });
    document.body.appendChild(toastWrap);
    function toast(message, type = 'success') {
        const el = Object.assign(document.createElement('div'), {
            className: 'pa-toast' + (type === 'error' ? ' error' : ''),
            textContent: message,
        });
        toastWrap.appendChild(el);
        requestAnimationFrame(() => el.classList.add('show'));
        setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2600);
    }
    function openModal(title, contentHTML) {
        const overlay = document.createElement('div');
        overlay.className = 'pa-overlay';
        overlay.innerHTML = `<div class="pa-modal" role="dialog" aria-modal="true"><h3>${title}</h3>${contentHTML}<button class="pa-close">Tutup</button></div>`;
        document.body.appendChild(overlay);
        const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
        const onKey = (e) => e.key === 'Escape' && close();
        document.addEventListener('keydown', onKey);
        overlay.addEventListener('click', (e) => e.target === overlay && close());
        $('.pa-close', overlay).addEventListener('click', close);
    }

    // ===== PENYIMPANAN =====
    const loadStore = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; } };
    const store = loadStore();
    const saveStore = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); } catch { toast('Penyimpanan penuh, data tidak tersimpan.', 'error'); } };

    // ===== 1. INFORMASI PRIBADI =====
    const personalBox = $('.personal-fields');
    const fieldBoxes = $$('.field-box', personalBox);
    // urutan sesuai HTML: nama, username, email, telepon, jabatan, alamat
    const FIELD_KEYS = ['nama', 'username', 'email', 'telepon', 'jabatan', 'alamat'];
    const LABELS = { nama: 'Nama lengkap', username: 'Username', email: 'Email', telepon: 'No. telepon', jabatan: 'Jabatan', alamat: 'Alamat' };

    // Data awal dibaca dari HTML, lalu ditimpa data tersimpan (jika ada)
    const readFromDOM = () => Object.fromEntries(FIELD_KEYS.map((key, i) => {
        const el = $('.gray-input', fieldBoxes[i]);
        const text = key === 'alamat'
            ? el.innerHTML.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
            : el.textContent;
        return [key, text.trim()];
    }));
    let profile = { ...readFromDOM(), ...(store.profile || {}) };

    function renderField(key, value) {
        const el = $('.gray-input', fieldBoxes[FIELD_KEYS.indexOf(key)]);
        const safe = escapeHTML(value);
        el.innerHTML = key === 'email' ? `<u>${safe}</u>` : key === 'alamat' ? safe.replace(/\n/g, '<br>') : safe;
    }

    // Banner (pills) ikut diperbarui; pill ke-4 diambil dari nama provinsi/negara bagian di alamat
    function renderBanner() {
        const pills = $$('.banner-pills .pill-item');
        const lastLine = profile.alamat.split('\n').pop() || '';
        const region = (lastLine.split(',').pop() || '').replace(/\d+/g, '').trim();
        const values = [profile.nama, profile.email, profile.telepon, region || pills[3]?.textContent];
        pills.forEach((p, i) => { if (values[i]) p.textContent = values[i]; });
        const img = $('.banner-avatar-circle img');
        if (img) img.alt = profile.nama;
    }
    function renderAll() {
        FIELD_KEYS.forEach((k) => renderField(k, profile[k]));
        renderBanner();
    }
    renderAll();

    // Validasi tiap kolom; mengembalikan pesan error atau null
    const validators = {
        nama: (v) => (v.length < 3 ? 'Nama minimal 3 karakter.' : null),
        username: (v) => (/^@?[a-zA-Z0-9_.]{3,}$/.test(v) ? null : 'Username minimal 3 karakter (huruf, angka, _ atau .).'),
        email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Format email tidak valid.'),
        telepon: (v) => (/^[0-9+\-\s]{8,18}$/.test(v) && v.replace(/\D/g, '').length >= 8 ? null : 'Nomor telepon tidak valid.'),
        jabatan: (v) => (v ? null : 'Jabatan wajib diisi.'),
        alamat: (v) => (v.length < 5 ? 'Alamat terlalu pendek.' : null),
    };

    // Tombol Edit / Simpan / Batal
    const actions = document.createElement('div');
    actions.className = 'pa-actions';
    actions.innerHTML = `
        <button type="button" class="pa-btn" id="pa-edit">Edit Profil</button>
        <button type="button" class="pa-btn" id="pa-cancel" hidden>Batal</button>
        <button type="button" class="pa-btn primary" id="pa-save" hidden>Simpan</button>`;
    personalBox.after(actions);
    const btnEdit = $('#pa-edit'), btnCancel = $('#pa-cancel'), btnSave = $('#pa-save');
    let editing = false;

    function setEditing(on) {
        editing = on;
        btnEdit.hidden = on;
        btnCancel.hidden = !on;
        btnSave.hidden = !on;
        FIELD_KEYS.forEach((key, i) => {
            const holder = $('.gray-input', fieldBoxes[i]);
            if (!on) { renderField(key, profile[key]); return; }
            const input = document.createElement(key === 'alamat' ? 'textarea' : 'input');
            input.className = 'pa-edit-input';
            input.name = key;
            input.value = profile[key];
            if (key === 'alamat') input.rows = 3;
            if (key === 'email') input.type = 'email';
            if (key === 'telepon') input.type = 'tel';
            holder.innerHTML = '';
            holder.appendChild(input);
            const err = document.createElement('div');
            err.className = 'pa-field-error';
            holder.appendChild(err);
        });
        if (on) $('.pa-edit-input', personalBox)?.focus();
    }

    btnEdit.addEventListener('click', () => setEditing(true));
    btnCancel.addEventListener('click', () => { setEditing(false); toast('Perubahan dibatalkan.'); });

    btnSave.addEventListener('click', () => {
        const next = {};
        let valid = true;
        FIELD_KEYS.forEach((key, i) => {
            const input = $('.pa-edit-input', fieldBoxes[i]);
            const errEl = $('.pa-field-error', fieldBoxes[i]);
            let value = input.value.trim();
            if (key === 'username' && value && !value.startsWith('@')) value = '@' + value;
            const error = validators[key](value);
            input.classList.toggle('invalid', !!error);
            errEl.textContent = error || '';
            if (error) valid = false;
            next[key] = value;
        });
        if (!valid) { toast('Periksa kembali data yang diisi.', 'error'); return; }

        const changed = FIELD_KEYS.filter((k) => next[k] !== profile[k]);
        if (!changed.length) { setEditing(false); toast('Tidak ada perubahan.'); return; }

        profile = next;
        store.profile = profile;
        saveStore();
        setEditing(false);
        renderBanner();
        addActivity('Mengubah Profil Admin');
        // TODO: kirim ke server, mis. fetch('/api/admin/profil', { method: 'PUT', body: JSON.stringify(profile) })
        toast(`Profil diperbarui (${changed.map((k) => LABELS[k]).join(', ')}).`);
    });

    // ===== 2. FOTO PROFIL: klik untuk ganti, tombol Unduh untuk menyimpan =====
    const avatarImg = $('.banner-avatar-circle img');
    if (store.avatar && avatarImg) avatarImg.src = store.avatar;

    const fileInput = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/png,image/jpeg,image/webp', hidden: true });
    document.body.appendChild(fileInput);
    $('.banner-avatar-circle')?.setAttribute('title', 'Klik untuk mengganti foto');
    $('.banner-avatar-circle')?.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        fileInput.value = '';
        if (!file) return;
        if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { toast('Format harus PNG, JPG, atau WEBP.', 'error'); return; }
        if (file.size > MAX_AVATAR_MB * 1024 * 1024) { toast(`Ukuran foto maksimal ${MAX_AVATAR_MB} MB.`, 'error'); return; }
        const reader = new FileReader();
        reader.onload = () => {
            avatarImg.src = reader.result;
            store.avatar = reader.result;
            saveStore();
            addActivity('Mengganti Foto Profil');
            toast('Foto profil diperbarui.');
        };
        reader.readAsDataURL(file);
    });

    $('.btn-unduh')?.addEventListener('click', async () => {
        try {
            const res = await fetch(avatarImg.currentSrc || avatarImg.src);
            const url = URL.createObjectURL(await res.blob());
            const a = Object.assign(document.createElement('a'), { href: url, download: 'foto-profil-admin.png' });
            document.body.appendChild(a); a.click(); a.remove();
            URL.revokeObjectURL(url);
            toast('Foto profil berhasil diunduh.');
        } catch {
            window.open(avatarImg.src, '_blank'); // cadangan jika diblokir CORS
            toast('Foto dibuka di tab baru.', 'error');
        }
    });

    // ===== 3. AKTIVITAS TERAKHIR + LIHAT SEMUA =====
    const activityCard = $$('.card').find((c) => $('.card-title', c)?.textContent.includes('Aktivitas Terakhir'));
    const activityRows = activityCard ? $('.info-rows', activityCard) : null;

    // Daftar aktivitas: dari penyimpanan, atau dibaca dari HTML saat pertama kali
    let activities = store.activities;
    if (!activities && activityRows) {
        activities = $$('.info-row', activityRows).map((row) => ({
            label: $('.info-key', row).textContent.replace(/\s+/g, ' ').trim(),
            time: parseDate(row.lastElementChild.textContent).toISOString(),
        }));
    }
    activities = activities || [];

    const sortedActivities = () => [...activities].sort((a, b) => new Date(b.time) - new Date(a.time));

    function renderActivities() {
        if (!activityRows) return;
        activityRows.innerHTML = sortedActivities().slice(0, MAX_RECENT).map((a) => `
            <div class="info-row">
                <span class="info-key wide-key">${escapeHTML(a.label)}</span>
                <span>: &nbsp;&nbsp;${formatDate(new Date(a.time))}</span>
            </div>`).join('');
    }

    function addActivity(label) {
        activities.push({ label, time: new Date().toISOString() });
        store.activities = activities;
        saveStore();
        renderActivities();
    }
    renderActivities();

    $('.btn-lihat-semua')?.addEventListener('click', (e) => {
        e.preventDefault();
        const items = sortedActivities().map((a) =>
            `<li><span>${escapeHTML(a.label)}</span><small>${formatDate(new Date(a.time))}</small></li>`).join('');
        openModal('Semua Aktivitas', items ? `<ul class="pa-log">${items}</ul>` : '<p>Belum ada aktivitas.</p>');
    });

    // ===== 4. PENCARIAN KARTU (navbar) =====
    const searchInput = $('.navbar-search input');
    searchInput?.addEventListener('input', () => {
        const q = searchInput.value.trim().toLowerCase();
        $$('.profile-grid .card').forEach((card) => {
            card.style.display = !q || card.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
    });

    // Peringatan jika meninggalkan halaman saat masih mode edit
    window.addEventListener('beforeunload', (e) => { if (editing) { e.preventDefault(); e.returnValue = ''; } });
});