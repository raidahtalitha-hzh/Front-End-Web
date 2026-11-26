/**
 * Si Perbaiki - Pengaturan (halaman pengaturan.html)
 *
 * PENTING: halaman ini membutuhkan tema.js (dipasang di <head> semua halaman):
 *   <script src="tema.js"></script>
 * tema.js yang mengurus tema gelap, ukuran font, bahasa, dan animasi tombol
 * sehingga perubahan berlaku di SEMUA halaman. File ini hanya mengatur kontrolnya.
 *
 * Fitur: toggle notifikasi & 2FA, pilihan tema/font/bahasa, unduh logo & avatar,
 * modal ubah password, logout semua perangkat, dan pencarian kartu.
 */
document.addEventListener('DOMContentLoaded', () => {
    // ===== KONFIGURASI =====
    const STORAGE_KEY = 'siperbaiki_pengaturan';
    const LOGIN_URL = 'login.html'; // tujuan setelah "Logout Semua"
    const FONT_OPTIONS = [
        { key: 'small', label: 'Kecil' },
        { key: 'medium', label: 'Sedang (Default)' },
        { key: 'large', label: 'Besar' },
    ];

    const Si = window.SiPerbaiki; // disediakan oleh tema.js
    const t = (text) => (Si ? Si.t(text) : text);

    // ===== PENYIMPANAN TOGGLE (digabung, tidak menimpa tema/font/bahasa) =====
    const defaultToggles = { laporanHarian: true, email: true, pembayaran: true, twoFactor: false };
    const readStore = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; } };
    const toggles = { ...defaultToggles, ...(readStore().toggles || {}) };
    const saveToggles = () => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readStore(), toggles })); } catch { /* abaikan */ }
    };

    // ===== STYLE KHUSUS HALAMAN (toast & modal) =====
    const style = document.createElement('style');
    style.textContent = `
        .sp-toast-wrap{position:fixed;right:20px;bottom:20px;display:flex;flex-direction:column;gap:8px;z-index:9999}
        .sp-toast{background:#1f2937;color:#fff;padding:10px 16px;border-radius:8px;font-size:13px;
            box-shadow:0 4px 14px rgba(0,0,0,.2);opacity:0;transform:translateY(8px);transition:.25s}
        .sp-toast.show{opacity:1;transform:none}
        .sp-toast.error{background:#b91c1c}
        .sp-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;
            justify-content:center;z-index:9998;padding:16px;animation:sp-fade .2s ease}
        @keyframes sp-fade{from{opacity:0}to{opacity:1}}
        .sp-modal{background:#fff;color:#111827;width:100%;max-width:400px;border-radius:12px;padding:22px;
            box-shadow:0 10px 30px rgba(0,0,0,.25);animation:sp-rise .25s ease}
        @keyframes sp-rise{from{transform:translateY(14px);opacity:0}to{transform:none;opacity:1}}
        .sp-modal h3{margin:0 0 6px;font-size:18px}
        .sp-modal p{margin:0 0 14px;font-size:13px;color:#6b7280}
        .sp-modal label{display:block;font-size:13px;margin:10px 0 4px}
        .sp-modal input{width:100%;padding:9px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;box-sizing:border-box}
        .sp-error{color:#b91c1c;font-size:12px;min-height:16px;margin-top:8px}
        .sp-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}
        .sp-actions button{padding:8px 16px;border-radius:6px;border:1px solid #d1d5db;background:#fff;color:#111827;font-size:13px}
        .sp-actions .sp-primary{background:#0891b2;border-color:#0891b2;color:#fff}
    `;
    document.head.appendChild(style);

    // ===== TOAST =====
    const toastWrap = Object.assign(document.createElement('div'), { className: 'sp-toast-wrap' });
    document.body.appendChild(toastWrap);
    function toast(message, type = 'success') {
        const el = Object.assign(document.createElement('div'), {
            className: 'sp-toast' + (type === 'error' ? ' error' : ''),
            textContent: message,
        });
        toastWrap.appendChild(el);
        requestAnimationFrame(() => el.classList.add('show'));
        setTimeout(() => {
            el.classList.remove('show');
            setTimeout(() => el.remove(), 300);
        }, 2600);
    }

    // ===== MODAL =====
    function openModal({ title, description, bodyHTML = '', confirmText = 'Simpan', onConfirm }) {
        const overlay = document.createElement('div');
        overlay.className = 'sp-overlay';
        overlay.innerHTML = `
            <div class="sp-modal" role="dialog" aria-modal="true">
                <h3>${title}</h3>
                <p>${description || ''}</p>
                <form novalidate>
                    ${bodyHTML}
                    <div class="sp-error"></div>
                    <div class="sp-actions">
                        <button type="button" data-cancel>Batal</button>
                        <button type="submit" class="sp-primary">${confirmText}</button>
                    </div>
                </form>
            </div>`;
        document.body.appendChild(overlay);

        const form = overlay.querySelector('form');
        const errorEl = overlay.querySelector('.sp-error');
        const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
        const onKey = (e) => e.key === 'Escape' && close();
        document.addEventListener('keydown', onKey);

        overlay.addEventListener('click', (e) => e.target === overlay && close());
        overlay.querySelector('[data-cancel]').addEventListener('click', close);
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const error = onConfirm ? onConfirm(form) : null;
            if (error) { errorEl.textContent = error; return; }
            close();
        });
        form.querySelector('input')?.focus();
    }

    // ===== 1. TOGGLE (notifikasi & verifikasi dua langkah) =====
    const toggleMap = [
        { key: 'laporanHarian', label: 'Notifikasi laporan harian' },
        { key: 'email', label: 'Notifikasi e-mail' },
        { key: 'pembayaran', label: 'Notifikasi pembayaran masuk' },
        { key: 'twoFactor', label: 'Verifikasi dua langkah' },
    ];
    document.querySelectorAll('.toggle-switch input[type="checkbox"]').forEach((input, i) => {
        const cfg = toggleMap[i];
        if (!cfg) return;
        input.checked = toggles[cfg.key];
        input.addEventListener('change', () => {
            toggles[cfg.key] = input.checked;
            saveToggles();
            toast(`${t(cfg.label)} ${t(input.checked ? 'diaktifkan' : 'dinonaktifkan')}.`);
        });
    });

    // ===== 2. TEMA TERANG / GELAP (berlaku di semua halaman lewat tema.js) =====
    const themeBoxes = document.querySelectorAll('.theme-box');
    const themeKeys = ['light', 'dark'];
    const markTheme = () => {
        const current = Si ? Si.prefs.theme : 'light';
        themeBoxes.forEach((box, i) => box.classList.toggle('active', themeKeys[i] === current));
    };
    themeBoxes.forEach((box, i) => {
        box.addEventListener('click', () => {
            if (!Si) { toast('tema.js belum dimuat di halaman ini.', 'error'); return; }
            Si.setTheme(themeKeys[i]);
            markTheme();
            toast(i === 0 ? 'Tema terang diterapkan.' : 'Tema gelap diterapkan.');
        });
    });
    markTheme();

    // ===== 3. UKURAN FONT (berlaku di semua halaman) =====
    const fontSelect = document.querySelector('.bordered-select');
    if (fontSelect) {
        fontSelect.innerHTML = FONT_OPTIONS.map((o) => `<option value="${o.key}">${o.label}</option>`).join('');
        fontSelect.value = Si ? Si.prefs.fontSize : 'medium';
        fontSelect.addEventListener('change', () => {
            if (!Si) { toast('tema.js belum dimuat di halaman ini.', 'error'); return; }
            Si.setFontSize(fontSelect.value);
            toast('Ukuran font diperbarui.');
        });
    }

    // ===== 4. BAHASA (kotak teks diubah menjadi dropdown) =====
    const langBox = document.querySelector('.bordered-input');
    if (langBox) {
        const langSelect = document.createElement('select');
        langSelect.className = 'bordered-select';
        langSelect.innerHTML = '<option value="id">Bahasa Indonesia</option><option value="en">English</option>';
        langSelect.value = Si ? Si.prefs.language : 'id';
        langBox.replaceWith(langSelect);
        langSelect.addEventListener('change', () => {
            if (!Si) { toast('tema.js belum dimuat di halaman ini.', 'error'); return; }
            Si.setLanguage(langSelect.value);
            toast(t('Preferensi bahasa disimpan.'));
        });
    }

    // ===== 5. UNDUH LOGO & AVATAR =====
    document.querySelectorAll('.btn-unduh').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const img = btn.closest('.logo-col, .avatar-col')?.querySelector('img');
            if (!img) return;
            const isLogo = !!btn.closest('.logo-col');
            const filename = isLogo ? 'logo-perusahaan.png' : 'avatar-admin.png';
            try {
                const res = await fetch(img.currentSrc || img.src);
                const url = URL.createObjectURL(await res.blob());
                const a = Object.assign(document.createElement('a'), { href: url, download: filename });
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
                toast(isLogo ? 'Logo berhasil diunduh.' : 'Foto berhasil diunduh.');
            } catch {
                window.open(img.src, '_blank'); // cadangan jika diblokir CORS
                toast('Gambar dibuka di tab baru.', 'error');
            }
        });
    });

    // ===== 6. UBAH PASSWORD & LOGOUT SEMUA =====
    const [btnPassword, btnLogoutAll] = document.querySelectorAll('.btn-cyan-outline');

    btnPassword?.addEventListener('click', () => {
        openModal({
            title: 'Ubah Password',
            description: 'Gunakan password minimal 8 karakter dengan kombinasi huruf dan angka.',
            bodyHTML: `
                <label>Password Saat Ini</label><input type="password" name="old" autocomplete="current-password">
                <label>Password Baru</label><input type="password" name="new" autocomplete="new-password">
                <label>Konfirmasi Password Baru</label><input type="password" name="confirm" autocomplete="new-password">`,
            confirmText: 'Simpan',
            onConfirm: (form) => {
                const { old: oldPw, new: newPw, confirm } = Object.fromEntries(new FormData(form));
                if (!oldPw || !newPw || !confirm) return 'Semua kolom wajib diisi.';
                if (newPw.length < 8) return 'Password baru minimal 8 karakter.';
                if (!/[A-Za-z]/.test(newPw) || !/\d/.test(newPw)) return 'Password harus mengandung huruf dan angka.';
                if (newPw === oldPw) return 'Password baru tidak boleh sama dengan password lama.';
                if (newPw !== confirm) return 'Konfirmasi password tidak cocok.';
                // TODO: kirim ke server, mis. fetch('/api/ubah-password', { method: 'POST', ... })
                toast(t('Password berhasil diubah.'));
                return null;
            },
        });
    });

    btnLogoutAll?.addEventListener('click', () => {
        openModal({
            title: 'Logout dari Semua Perangkat',
            description: 'Anda akan keluar dari semua perangkat yang sedang login, termasuk perangkat ini.',
            confirmText: 'Ya, Logout Semua',
            onConfirm: () => {
                // TODO: panggil API untuk mencabut semua sesi/token
                toast(t('Berhasil logout dari semua perangkat.'));
                setTimeout(() => { window.location.href = LOGIN_URL; }, 1200);
                return null;
            },
        });
    });

    // ===== 7. PENCARIAN KARTU PENGATURAN (navbar) =====
    const searchInput = document.querySelector('.navbar-search input');
    const cards = document.querySelectorAll('.settings-row .card');
    searchInput?.addEventListener('input', () => {
        const q = searchInput.value.trim().toLowerCase();
        cards.forEach((card) => {
            card.style.display = !q || card.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
    });
});