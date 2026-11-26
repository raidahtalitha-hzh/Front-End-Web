/**
 * Si Perbaiki - Laporan Kinerja
 * Fitur: pagination, pencarian teknisi, sorting kolom, update KPI otomatis,
 * tooltip grafik, dan perapihan data kosong.
 *
 * Cara pakai: tambahkan sebelum </body> pada laporan-kinerja.html
 *   <script src="laporan-kinerja.js"></script>
 */
document.addEventListener('DOMContentLoaded', () => {
    // ===== KONFIGURASI =====
    const ROWS_PER_PAGE = 5;      // jumlah baris per halaman
    const UPDATE_KPI = true;      // hitung ulang KPI dari data tabel

    // ===== ELEMEN =====
    const tbody = document.querySelector('.data-table tbody');
    const headers = document.querySelectorAll('.data-table thead th');
    const paginationEl = document.querySelector('.pagination');
    const searchInput = document.querySelector('.navbar-search input');
    const kpiValues = document.querySelectorAll('.kpi-value');
    if (!tbody || !paginationEl) return;

    // ===== AMBIL DATA DARI TABEL (HTML tetap jadi sumber data) =====
    const allRows = Array.from(tbody.querySelectorAll('tr'));
    const num = (cell) => parseInt(cell?.textContent.trim(), 10) || 0;

    const data = allRows.map((tr, i) => {
        const c = tr.children;
        // Isi sel "Tertunda" yang kosong dengan 0
        if (c[5] && c[5].textContent.trim() === '') c[5].textContent = '0';
        return {
            el: tr,
            no: num(c[0]) || i + 1,
            nama: c[1].textContent.trim(),
            total: num(c[2]),
            selesai: num(c[3]),
            proses: num(c[4]),
            tertunda: num(c[5]),
        };
    });

    // ===== STATE =====
    let state = {
        page: 1,
        query: '',
        sortKey: null,   // 'no' | 'nama' | 'total' | 'selesai' | 'proses' | 'tertunda'
        sortDir: 'asc',
    };
    const columnKeys = ['no', 'nama', 'total', 'selesai', 'proses', 'tertunda'];

    // Baris "tidak ada data"
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="6" style="text-align:center;padding:20px;">Data teknisi tidak ditemukan.</td>';

    // ===== FILTER + SORT =====
    function getFilteredData() {
        let result = data.filter((d) => d.nama.toLowerCase().includes(state.query));

        if (state.sortKey) {
            const dir = state.sortDir === 'asc' ? 1 : -1;
            result = [...result].sort((a, b) => {
                const x = a[state.sortKey];
                const y = b[state.sortKey];
                return typeof x === 'string' ? x.localeCompare(y) * dir : (x - y) * dir;
            });
        }
        return result;
    }

    // ===== RENDER TABEL =====
    function renderTable() {
        const filtered = getFilteredData();
        const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
        state.page = Math.min(Math.max(state.page, 1), totalPages);

        const start = (state.page - 1) * ROWS_PER_PAGE;
        const pageItems = filtered.slice(start, start + ROWS_PER_PAGE);

        tbody.innerHTML = '';
        if (pageItems.length === 0) {
            tbody.appendChild(emptyRow);
        } else {
            pageItems.forEach((d) => tbody.appendChild(d.el));
        }

        renderPagination(totalPages);
        updateHeaderIndicators();
    }

    // ===== RENDER PAGINATION =====
    function renderPagination(totalPages) {
        paginationEl.innerHTML = '';

        const makeBtn = (label, page, { active = false, disabled = false } = {}) => {
            const btn = document.createElement('button');
            btn.className = 'page-btn' + (active ? ' active' : '');
            btn.textContent = label;
            btn.disabled = disabled;
            if (disabled) btn.style.cursor = 'not-allowed', btn.style.opacity = '0.5';
            btn.addEventListener('click', () => {
                state.page = page;
                renderTable();
            });
            return btn;
        };

        paginationEl.appendChild(makeBtn('<', state.page - 1, { disabled: state.page === 1 }));

        getPageList(state.page, totalPages).forEach((p) => {
            if (p === '...') {
                const dots = document.createElement('span');
                dots.textContent = '...';
                dots.style.padding = '0 6px';
                paginationEl.appendChild(dots);
            } else {
                paginationEl.appendChild(makeBtn(p, p, { active: p === state.page }));
            }
        });

        paginationEl.appendChild(makeBtn('>', state.page + 1, { disabled: state.page === totalPages }));
    }

    // Daftar nomor halaman dengan ellipsis (mis. 1 ... 4 5 6 ... 12)
    function getPageList(current, total) {
        if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
        const pages = new Set([1, total, current - 1, current, current + 1]);
        const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
        const out = [];
        sorted.forEach((p, i) => {
            if (i > 0 && p - sorted[i - 1] > 1) out.push('...');
            out.push(p);
        });
        return out;
    }

    // ===== SORTING (klik header kolom) =====
    headers.forEach((th, i) => {
        th.dataset.label = th.dataset.label || th.textContent.trim();
        th.style.cursor = 'pointer';
        th.title = 'Klik untuk mengurutkan';
        th.addEventListener('click', () => {
            const key = columnKeys[i];
            if (state.sortKey === key) {
                state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
            } else {
                state.sortKey = key;
                state.sortDir = 'asc';
            }
            state.page = 1;
            renderTable();
        });
    });

    function updateHeaderIndicators() {
        headers.forEach((th, i) => {
            const isActive = columnKeys[i] === state.sortKey;
            const arrow = isActive ? (state.sortDir === 'asc' ? ' ▲' : ' ▼') : '';
            th.textContent = th.dataset.label + arrow;
        });
    }

    // ===== PENCARIAN (kolom "Cari sesuatu..." di navbar) =====
    if (searchInput) {
        let timer;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                state.query = e.target.value.trim().toLowerCase();
                state.page = 1;
                renderTable();
            }, 200); // debounce
        });
    }

    // ===== KPI OTOMATIS =====
    function updateKPI() {
        if (!UPDATE_KPI || kpiValues.length < 2) return;
        const totalSelesai = data.reduce((sum, d) => sum + d.selesai, 0);
        kpiValues[0].textContent = data.length;   // Total Teknisi
        kpiValues[1].textContent = totalSelesai;  // Servis Selesai
        // KPI 3 (rata-rata hari) & 4 (kepuasan) butuh data dari server, jadi dibiarkan.
    }

    // ===== TOOLTIP GRAFIK =====
    function initChart() {
        const labels = ['Ganti SparePart', 'Perbaikan Software', 'Pembersihan / Maintenance', 'Pengecekan'];
        const maxValue = 40; // sesuai sumbu Y (0 - 40)
        document.querySelectorAll('.bars-row .bar').forEach((bar, i) => {
            const pct = parseFloat(bar.style.height) || 0;
            const value = Math.round((pct / 100) * maxValue);
            bar.title = `${labels[i] || 'Kategori'}: ${value} servis`;
            bar.style.cursor = 'pointer';
        });
    }

    // ===== INISIALISASI =====
    updateKPI();
    initChart();
    renderTable();
});