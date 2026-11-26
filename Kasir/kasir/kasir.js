/*
 * kasir.js - Si Perbaiki (cocok dengan kasir.html tanpa perubahan HTML)
 * - Tambah / hapus / ubah qty item di keranjang
 * - Pembayaran sesuai metode: Tunai, Transfer, E-Wallet, QRIS
 * - Cetak nota + simpan riwayat transaksi (localStorage)
 */
(function () {
  'use strict';

  /* ===== KONFIGURASI (ubah sesuai kebutuhan) ===== */
  const CONFIG = {
    namaRekening: 'Si Perbaiki',
    rekening: { BCA: '1234567890', BRI: '0987654321', Mandiri: '1122334455' },
    ewallet: ['GoPay', 'OVO', 'DANA', 'ShopeePay'],
    qrisImage: '' // isi path gambar QRIS, contoh: '../img/qris.png'
  };

  const KEY = 'siperbaiki_keranjang';
  const KEY_TRX = 'siperbaiki_transaksi';
  let cart = [];
  let diskon = 0;

  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => Array.from(p.querySelectorAll(s));
  const rupiah = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
  const angka = (v) => parseInt(String(v).replace(/\D/g, ''), 10) || 0;
  const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ===== Style tambahan (disuntik lewat JS) ===== */
  const style = document.createElement('style');
  style.textContent = `
    .cart-table .qty-ctrl{display:inline-flex;align-items:center;gap:6px}
    .cart-table .qty-ctrl button,.cart-table .btn-hapus{border:1px solid #ccc;background:#fff;border-radius:4px;cursor:pointer;padding:0 6px;line-height:20px}
    .cart-table .btn-hapus{color:#d32f2f;border-color:#d32f2f}
    .cart-empty{text-align:center;color:#888;padding:12px}
    .pill.active{outline:2px solid #333}
    .kasir-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:9999}
    .kasir-modal{background:#fff;color:#222;border-radius:10px;padding:20px;width:min(380px,92vw);font-size:14px}
    .kasir-modal h3{margin:0 0 6px}
    .kasir-modal input,.kasir-modal select{width:100%;padding:8px;margin:6px 0;border:1px solid #bbb;border-radius:6px;box-sizing:border-box}
    .kasir-modal .info{background:#f3f3f3;border-radius:6px;padding:8px;margin:6px 0}
    .kasir-modal .qr{width:180px;height:180px;margin:10px auto;border:2px dashed #888;display:flex;align-items:center;justify-content:center;font-weight:bold}
    .kasir-modal .qr img{max-width:100%;max-height:100%}
    .kasir-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}
    .kasir-actions button{padding:8px 14px;border-radius:6px;border:1px solid #888;background:#fff;cursor:pointer}
    .kasir-actions .ok{background:#1976d2;color:#fff;border-color:#1976d2}
    .toast-add{opacity:.7}
  `;
  document.head.appendChild(style);

  /* ===== Penyimpanan ===== */
  function simpan() { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) {} }
  function muat() {
    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) {}
    if (saved !== null) {
      try { cart = JSON.parse(saved) || []; return; } catch (e) {}
    }
    // Pertama kali: ambil isi awal dari tabel di HTML
    cart = $$('.cart-table tbody tr').map((tr) => {
      const td = tr.children;
      const nama = norm(td[1].textContent);
      return { id: nama, nama, harga: angka(td[2].textContent), qty: angka(td[3].textContent) || 1 };
    });
  }

  /* ===== Keranjang ===== */
  function tambahItem(nama, harga) {
    const id = norm(nama);
    const ada = cart.find((i) => i.id === id);
    if (ada) ada.qty += 1; else cart.push({ id, nama: id, harga, qty: 1 });
    render();
  }
  function ubahQty(id, d) {
    const it = cart.find((i) => i.id === id);
    if (!it) return;
    it.qty += d;
    if (it.qty <= 0) return hapusItem(id);
    render();
  }
  function hapusItem(id) { cart = cart.filter((i) => i.id !== id); render(); }

  function hitung() {
    const subtotal = cart.reduce((s, i) => s + i.harga * i.qty, 0);
    const d = Math.min(diskon, subtotal);
    return { subtotal, diskon: d, total: subtotal - d };
  }

  function render() {
    const table = $('.cart-table');
    const thead = $('thead tr', table);
    if (thead && thead.children.length < 6) {
      const th = document.createElement('th'); th.textContent = 'Aksi'; thead.appendChild(th);
    }
    const tbody = $('tbody', table);
    tbody.innerHTML = cart.length ? cart.map((i, n) => `
      <tr>
        <td>${n + 1}</td>
        <td>${esc(i.nama)}</td>
        <td>${i.harga.toLocaleString('id-ID')}</td>
        <td><span class="qty-ctrl">
          <button type="button" data-aksi="kurang" data-id="${esc(i.id)}">-</button>
          ${i.qty}
          <button type="button" data-aksi="tambah" data-id="${esc(i.id)}">+</button></span></td>
        <td>${(i.harga * i.qty).toLocaleString('id-ID')}</td>
        <td><button type="button" class="btn-hapus" title="Hapus" data-aksi="hapus" data-id="${esc(i.id)}">&times;</button></td>
      </tr>`).join('')
      : '<tr><td colspan="6" class="cart-empty">Keranjang kosong</td></tr>';

    const t = hitung();
    const lines = $$('.totals-box .total-line');
    if (lines[0]) lines[0].lastElementChild.textContent = rupiah(t.subtotal);
    if (lines[1]) {
      const el = lines[1].lastElementChild;
      el.textContent = rupiah(t.diskon);
      el.style.cursor = 'pointer';
      el.title = 'Klik untuk mengisi diskon';
    }
    const gt = $('.grand-total');
    if (gt) gt.lastElementChild.textContent = rupiah(t.total);
    simpan();
  }

  /* ===== Filter layanan (pencarian + kategori) ===== */
  let kategori = 'semua';
  function kategoriCard(nama) {
    if (/laptop/i.test(nama)) return 'laptop';
    if (/\bhp\b/i.test(nama)) return 'hp';
    if (/\btv\b/i.test(nama)) return 'tv';
    if (/\bac\b/i.test(nama)) return 'ac';
    return 'lainnya';
  }
  function filterServis() {
    const q = ($('.servis-search input')?.value || '').toLowerCase().trim();
    $$('.servis-card').forEach((c) => {
      const nama = norm($('.servis-title', c).textContent);
      const cocokKat = kategori === 'semua' || kategoriCard(nama) === kategori;
      c.style.display = cocokKat && nama.toLowerCase().includes(q) ? '' : 'none';
    });
  }

  /* ===== Pembayaran ===== */
  const metodeAktif = () => norm($('.pay-option.active')?.textContent || 'Tunai');

  function bodyMetode(metode, total) {
    switch (metode) {
      case 'Tunai':
        return `<label>Uang diterima</label>
          <input id="m-uang" inputmode="numeric" placeholder="0">
          <button type="button" id="m-pas" style="margin-bottom:6px">Uang pas</button>
          <div class="info">Kembalian: <b id="m-kembali">Rp 0</b></div>`;
      case 'Transfer':
        return `<label>Bank tujuan</label>
          <select id="m-bank">${Object.keys(CONFIG.rekening).map((b) => `<option>${b}</option>`).join('')}</select>
          <div class="info" id="m-rek"></div>
          <label>No. referensi transfer</label>
          <input id="m-ref" placeholder="Contoh: 20261126XXXX">`;
      case 'E-Wallet':
        return `<label>Pilih e-wallet</label>
          <select id="m-wallet">${CONFIG.ewallet.map((w) => `<option>${w}</option>`).join('')}</select>
          <label>Nomor e-wallet pelanggan</label>
          <input id="m-nohp" inputmode="numeric" placeholder="08xxxxxxxxxx">`;
      case 'QRIS':
        return `<div class="qr">${CONFIG.qrisImage ? `<img src="${CONFIG.qrisImage}" alt="QRIS">` : 'QRIS'}</div>
          <div class="info">Minta pelanggan memindai QRIS lalu pastikan pembayaran <b>${rupiah(total)}</b> sudah masuk.</div>`;
      default: return '';
    }
  }

  function bukaModal(metode, total, onSukses) {
    const ov = document.createElement('div');
    ov.className = 'kasir-overlay';
    ov.innerHTML = `<div class="kasir-modal">
      <h3>Pembayaran ${esc(metode)}</h3>
      <p>Total tagihan: <b>${rupiah(total)}</b></p>
      ${bodyMetode(metode, total)}
      <div class="kasir-actions">
        <button type="button" data-m="batal">Batal</button>
        <button type="button" data-m="ok" class="ok">Konfirmasi Pembayaran</button>
      </div></div>`;
    document.body.appendChild(ov);
    const tutup = () => ov.remove();

    if (metode === 'Tunai') {
      const uang = $('#m-uang', ov);
      const upd = () => {
        const n = angka(uang.value);
        uang.value = n ? n.toLocaleString('id-ID') : '';
        $('#m-kembali', ov).textContent = rupiah(Math.max(n - total, 0));
      };
      uang.addEventListener('input', upd);
      $('#m-pas', ov).addEventListener('click', () => { uang.value = total; upd(); });
      uang.focus();
    }
    if (metode === 'Transfer') {
      const bank = $('#m-bank', ov);
      const upd = () => {
        $('#m-rek', ov).innerHTML = `${esc(bank.value)}: <b>${CONFIG.rekening[bank.value]}</b><br>a.n. ${esc(CONFIG.namaRekening)}`;
      };
      bank.addEventListener('change', upd); upd();
    }

    ov.addEventListener('click', (e) => {
      if (e.target === ov || e.target.dataset.m === 'batal') return tutup();
      if (e.target.dataset.m !== 'ok') return;

      let detail = {};
      if (metode === 'Tunai') {
        const uang = angka($('#m-uang', ov).value);
        if (uang < total) return alert('Uang yang diterima kurang dari total tagihan.');
        detail = { diterima: uang, kembalian: uang - total };
      } else if (metode === 'Transfer') {
        const ref = $('#m-ref', ov).value.trim();
        if (ref.length < 4) return alert('Masukkan nomor referensi transfer yang valid.');
        detail = { bank: $('#m-bank', ov).value, referensi: ref };
      } else if (metode === 'E-Wallet') {
        const no = $('#m-nohp', ov).value.replace(/\D/g, '');
        if (no.length < 10) return alert('Nomor e-wallet tidak valid (minimal 10 digit).');
        detail = { wallet: $('#m-wallet', ov).value, nomor: no };
      } else if (metode === 'QRIS') {
        if (!confirm('Pembayaran QRIS sudah diterima?')) return;
      }
      tutup();
      onSukses(detail);
    });
  }

  function dataPelanggan() {
    const v = $$('.customer-details .detail-val').map((e) => norm(e.textContent));
    return { nama: v[0] || '-', telepon: v[1] || '-', alamat: v[2] || '-', catatan: v[3] || '-' };
  }

  function prosesPembayaran() {
    if (!cart.length) return alert('Keranjang masih kosong.');
    const metode = metodeAktif();
    const t = hitung();
    bukaModal(metode, t.total, (detail) => {
      const trx = {
        no: 'INV-' + Date.now(),
        tanggal: new Date().toLocaleString('id-ID'),
        pelanggan: dataPelanggan(),
        metode,
        items: cart.map((i) => ({ ...i })),
        ...t, ...detail
      };
      try {
        const r = JSON.parse(localStorage.getItem(KEY_TRX)) || [];
        r.push(trx);
        localStorage.setItem(KEY_TRX, JSON.stringify(r));
      } catch (e) {}
      cetakNota(trx);
      cart = []; diskon = 0; render();
    });
  }

  /* ===== Nota ===== */
  function cetakNota(t) {
    const w = window.open('', '_blank', 'width=380,height=640');
    if (!w) return alert('Pembayaran tercatat, tetapi popup nota diblokir browser. Izinkan popup untuk mencetak.');
    const baris = t.items.map((i) =>
      `<tr><td>${esc(i.nama)} x${i.qty}</td><td class="r">${rupiah(i.harga * i.qty)}</td></tr>`).join('');
    let extra = '';
    if (t.metode === 'Tunai') extra = `<tr><td>Diterima</td><td class="r">${rupiah(t.diterima)}</td></tr><tr><td>Kembalian</td><td class="r">${rupiah(t.kembalian)}</td></tr>`;
    if (t.metode === 'Transfer') extra = `<tr><td>Bank</td><td class="r">${esc(t.bank)}</td></tr><tr><td>Ref</td><td class="r">${esc(t.referensi)}</td></tr>`;
    if (t.metode === 'E-Wallet') extra = `<tr><td>${esc(t.wallet)}</td><td class="r">${esc(t.nomor)}</td></tr>`;
    w.document.write(`<html><head><title>Nota ${t.no}</title><style>
      body{font-family:monospace;font-size:13px;padding:12px}table{width:100%}.r{text-align:right}hr{border:0;border-top:1px dashed #000}
      </style></head><body>
      <h3 style="text-align:center;margin:0">Si Perbaiki</h3><p style="text-align:center;margin:4px 0">Nota Terima</p><hr>
      <div>No: ${t.no}<br>Tgl: ${t.tanggal}<br>Pelanggan: ${esc(t.pelanggan.nama)}<br>Telp: ${esc(t.pelanggan.telepon)}</div><hr>
      <table>${baris}</table><hr>
      <table>
        <tr><td>Subtotal</td><td class="r">${rupiah(t.subtotal)}</td></tr>
        <tr><td>Diskon</td><td class="r">${rupiah(t.diskon)}</td></tr>
        <tr><td><b>Total</b></td><td class="r"><b>${rupiah(t.total)}</b></td></tr>
        <tr><td>Metode</td><td class="r">${esc(t.metode)}</td></tr>${extra}
      </table><hr><p style="text-align:center">Terima kasih</p>
      <script>window.onload=function(){window.print();}<\/script></body></html>`);
    w.document.close();
  }

  /* ===== Event ===== */
  function init() {
    muat();

    // Data pelanggan bisa diedit langsung (klik teksnya)
    $$('.customer-details .detail-val').forEach((e) => e.setAttribute('contenteditable', 'true'));

    document.addEventListener('click', (e) => {
      const add = e.target.closest('.btn-add');
      if (add) {
        const card = add.closest('.servis-card, .part-card');
        const nama = $('.servis-title, .part-name', card).textContent;
        const harga = angka($('.servis-price, .part-price', card).textContent);
        tambahItem(nama, harga);
        const asli = add.textContent;
        add.textContent = '✓ Ditambahkan';
        add.classList.add('toast-add');
        setTimeout(() => { add.textContent = asli; add.classList.remove('toast-add'); }, 700);
        return;
      }

      const aksi = e.target.closest('[data-aksi]');
      if (aksi) {
        const { aksi: a, id } = aksi.dataset;
        if (a === 'tambah') ubahQty(id, 1);
        else if (a === 'kurang') ubahQty(id, -1);
        else if (a === 'hapus') hapusItem(id);
        return;
      }

      const pay = e.target.closest('.pay-option');
      if (pay) {
        $$('.pay-option').forEach((b) => b.classList.remove('active'));
        pay.classList.add('active');
        return;
      }

      const pill = e.target.closest('.category-pills .pill');
      if (pill) {
        $$('.category-pills .pill').forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        kategori = (pill.className.match(/p-(\w+)/) || [])[1] || 'semua';
        filterServis();
        return;
      }

      // Klik nilai diskon untuk mengubahnya
      const lines = $$('.totals-box .total-line');
      if (lines[1] && lines[1].lastElementChild === e.target) {
        const v = prompt('Masukkan diskon (Rp):', diskon || 0);
        if (v !== null) { diskon = angka(v); render(); }
      }
    });

    $('.servis-search input')?.addEventListener('input', filterServis);
    $('.btn-checkout')?.addEventListener('click', prosesPembayaran);
    render();
  }

  document.addEventListener('DOMContentLoaded', init);
})();