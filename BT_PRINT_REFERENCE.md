# Referensi: Cetak Bon via Bluetooth (Thermal Printer)

> **Catatan**: Fitur ini tidak aktif di versi saat ini.
> Simpan sebagai referensi untuk implementasi di masa mendatang.

## Cara Kerja

Web Bluetooth API digunakan untuk mengirim data ESC/POS ke printer thermal Bluetooth.
Hanya berfungsi di **Chrome Android** (bukan Safari, bukan Firefox).

## Kode Referensi (JavaScript)

```javascript
let bleChar = null;

async function printBT(struktText) {
  try {
    if (!bleChar) {
      const dev = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb',
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2'
        ]
      });
      const srv = await dev.gatt.connect();
      let chr;
      try {
        const svc = await srv.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
        chr = await svc.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
      } catch {
        const svc = await srv.getPrimaryService('e7810a71-73ae-499d-8c15-faa9aef0c3f2');
        chr = await svc.getCharacteristic('bef8d6c9-9c21-4c9e-b632-bd58c1009f9f');
      }
      bleChar = chr;
    }

    const ESC  = String.fromCharCode(27);
    const GS   = String.fromCharCode(29);
    const full = ESC + '@' + ESC + 'a\x00' + struktText + '\n\n\n' + GS + 'V\x41\x03';
    const data = new TextEncoder().encode(full);

    // Kirim dalam chunk 200 byte
    for (let i = 0; i < data.length; i += 200) {
      await bleChar.writeValue(data.slice(i, i + 200));
    }
  } catch (e) {
    if (e.name === 'NotFoundError' || e.name === 'NotSupportedError') return;
    bleChar = null;
    alert('Gagal cetak: ' + e.message);
  }
}
```

## Format Struk ESC/POS

```
================================
      TOKO SINAR JAYA
  Sembako & Kelontong Bandung
================================
No Faktur: SJ-20260404-0001
Tgl      : 4 April 2026 08:30
--------------------------------
Barang                     Total
--------------------------------
Beras 5kg               Rp 62.500
Minyak Goreng 2L        Rp 32.000
--------------------------------
TOTAL          :       Rp 94.500
================================
        Terima kasih!
================================
```

## Persyaratan

- Browser: Chrome Android ≥ 85
- Aktifkan: `chrome://flags/#enable-experimental-web-platform-features`
- Izinkan akses Bluetooth saat diminta browser
- Printer harus dalam mode pairing/discoverable
