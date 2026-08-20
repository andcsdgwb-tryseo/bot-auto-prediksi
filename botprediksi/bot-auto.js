const admin = require('firebase-admin');
const https = require('https');
const { createCanvas, loadImage } = require('canvas');
const FormData = require('form-data');
const path = require('path');

// ==========================================
// 1. INISIALISASI FIREBASE ADMIN SDK
// ==========================================
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// ==========================================
// 2. KONFIGURASI TELEGRAM BOT & TOPIC ID
// ==========================================
const TELEGRAM_TOKEN           = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID         = process.env.TELEGRAM_CHAT_ID || "-1004474947415";
const TELEGRAM_TOPIC_GAMBAR_ID = process.env.TELEGRAM_TOPIC_GAMBAR_ID || 27; // Topic: PREDIKSI GAMBAR TOGEL
const TELEGRAM_TOPIC_TEXT_ID   = process.env.TELEGRAM_TOPIC_TEXT_ID || 29;   // Topic: ANGKA PREDIKSI

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Daftar 18 Pasaran
const DAFTAR_PASARAN = [
  "TOTOWUHAN", "HKSIANG", "SYDNEY4D", "TAIPEI", "SGMETRO", "BUSANDAY",
  "SINGAPORE", "MALAYSIA", "MACAU", "BUSANNIGHT", "QATAR", "HONGKONG",
  "TOTOMACAU 13", "TOTOMACAU 16", "TOTOMACAU 19", "TOTOMACAU 22", 
  "TOTOMACAU 23", "TOTOMACAU 00"
];

const MAP_NAMA_DISPLAY = {
  "HKSIANG":      "HONGKONG SIANG",
  "TOTOMACAU 00": "TOTO MACAU 0000",
  "TOTOMACAU 13": "TOTO MACAU 1300",
  "TOTOMACAU 16": "TOTO MACAU 1600",
  "TOTOMACAU 19": "TOTO MACAU 1900",
  "TOTOMACAU 22": "TOTO MACAU 2200",
  "TOTOMACAU 23": "TOTO MACAU 2300"
};

// Kelompok Pasaran untuk 3 Template Banner
const KELOMPOK_PASARAN_1 = ["SINGAPORE", "MALAYSIA", "MACAU", "BUSANNIGHT", "QATAR", "HONGKONG"];
const KELOMPOK_PASARAN_2 = ["TOTOWUHAN", "HKSIANG", "SYDNEY4D", "TAIPEI", "SGMETRO", "BUSANDAY"];
const KELOMPOK_MACAU      = ["TOTOMACAU 13", "TOTOMACAU 16", "TOTOMACAU 19", "TOTOMACAU 22", "TOTOMACAU 23", "TOTOMACAU 00"];

const JADWAL_JAM = {
  "TOTOWUHAN":    { tutup: "10:00 WIB", result: "10:30 WIB" },
  "HKSIANG":      { tutup: "10:30 WIB", result: "11:00 WIB" },
  "SYDNEY4D":     { tutup: "13:35 WIB", result: "14:00 WIB" },
  "TAIPEI":       { tutup: "14:30 WIB", result: "15:00 WIB" },
  "SGMETRO":      { tutup: "11:30 WIB", result: "12:00 WIB" },
  "BUSANDAY":     { tutup: "15:00 WIB", result: "15:30 WIB" },
  "SINGAPORE":    { tutup: "17:35 WIB", result: "17:45 WIB" },
  "MALAYSIA":     { tutup: "18:30 WIB", result: "19:00 WIB" },
  "MACAU":        { tutup: "21:00 WIB", result: "21:30 WIB" },
  "BUSANNIGHT":   { tutup: "21:30 WIB", result: "22:00 WIB" },
  "QATAR":        { tutup: "20:00 WIB", result: "20:30 WIB" },
  "HONGKONG":     { tutup: "22:45 WIB", result: "23:00 WIB" },
  "TOTOMACAU 00": { tutup: "23:45 WIB", result: "00:00 WIB" },
  "TOTOMACAU 13": { tutup: "12:45 WIB", result: "13:00 WIB" },
  "TOTOMACAU 16": { tutup: "15:45 WIB", result: "16:00 WIB" },
  "TOTOMACAU 19": { tutup: "18:45 WIB", result: "19:00 WIB" },
  "TOTOMACAU 22": { tutup: "21:45 WIB", result: "22:00 WIB" },
  "TOTOMACAU 23": { tutup: "22:45 WIB", result: "23:00 WIB" }
};

const JADWAL_OFF = {
  "SINGAPORE": [2, 5], // Selasa & Jumat
  "TAIPEI": [1]        // Senin
};

const DAFTAR_SHIO = [
  "Tikus", "Kerbau", "Harimau", "Kelinci", "Naga", "Ular", 
  "Kuda", "Kambing", "Monyet", "Ayam", "Anjing", "Babi"
];

// ==========================================
// 3. HELPER DATE & TIME (WIB)
// ==========================================
function getTodayWIB() {
  const options = { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' };
  return new Intl.DateTimeFormat('en-CA', options).format(new Date());
}

function getFormattedDateWIB() {
  const options = { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' };
  return new Intl.DateTimeFormat('id-ID', options).format(new Date()).toUpperCase();
}

function getDayOfWeekWIB() {
  const options = { timeZone: 'Asia/Jakarta', weekday: 'short' };
  const dayStr = new Intl.DateTimeFormat('en-US', options).format(new Date());
  const daysMap = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
  return daysMap[dayStr];
}

// ==========================================
// 4. RANDOM GENERATOR PREDIKSI
// ==========================================
function generateBBFS() {
  const digits = [];
  while (digits.length < 5) {
    const rand = Math.floor(Math.random() * 10).toString();
    if (!digits.includes(rand)) digits.push(rand);
  }
  return digits.join('');
}

function getRandomDigitComboArr(bbfsArr, digitLength, count) {
  const results = new Set();
  let attempts = 0;
  while (results.size < count && attempts < 50) {
    attempts++;
    const shuffled = [...bbfsArr].sort(() => 0.5 - Math.random());
    results.add(shuffled.slice(0, digitLength).join(''));
  }
  return Array.from(results);
}

function generatePredictionDetails(bbfsStr) {
  if (!bbfsStr || bbfsStr === "LIBUR") {
    return {
      cb: '-', cm: '-', shio: '-', twin: '-',
      d2Arr: ['-', '-', '-', '-', '-'],
      d3Arr: ['-', '-', '-', '-'],
      d4Arr: ['-', '-', '-', '-'],
      d2: '-', d3: '-', d4: '-'
    };
  }

  const arr = bbfsStr.split('');
  const cb = arr[0];
  const cm = `${arr[0]} / ${arr[1]}`;
  const shio = DAFTAR_SHIO[Math.floor(Math.random() * DAFTAR_SHIO.length)];
  const twin = `${arr[0]}${arr[0]} / ${arr[1]}${arr[1]}`;
  
  const d2Arr = [
    `${arr[0]}${arr[1]}`, `${arr[1]}${arr[2]}`, `${arr[2]}${arr[3]}`, 
    `${arr[3]}${arr[4]}`, `${arr[0]}${arr[4]}`
  ];
  const d3Arr = getRandomDigitComboArr(arr, 3, 4);
  const d4Arr = getRandomDigitComboArr(arr, 4, 4);

  return { 
    cb, cm, shio, twin, 
    d2Arr, d3Arr, d4Arr,
    d2: d2Arr.join('*'),
    d3: d3Arr.join('*'),
    d4: d4Arr.join('*')
  };
}

// ==========================================
// 5. HELPER FORMAT & KIRIM TEKS TELEGRAM
// ==========================================
function formatTelegramMessage(pasaran, tanggal, bbfs, details) {
  const namaTampil = MAP_NAMA_DISPLAY[pasaran] || pasaran;
  if (bbfs === "LIBUR") {
    return `🔥 <b>PREDIKSI ${namaTampil}</b> 🔥\n📅 Tanggal: <code>${tanggal}</code>\n----------------------------------\n⛔ <b>PASARAN LIBUR HARI INI</b>`;
  }

  return `🔥 <b>PREDIKSI ${namaTampil}</b> 🔥\n` +
         `📅 Tanggal: <code>${tanggal}</code>\n` +
         `----------------------------------\n` +
         `🎯 <b>BBFS:</b> <code>${bbfs}</code>\n` +
         `🎯 <b>Colok Bebas:</b> <code>${details.cb}</code>\n` +
         `🎯 <b>Colok Macau:</b> <code>${details.cm}</code>\n` +
         `🎯 <b>Shio:</b> ${details.shio}\n` +
         `🎯 <b>Twin:</b> <code>${details.twin}</code>\n` +
         `----------------------------------\n` +
         `🎲 <b>2D:</b> <code>${details.d2}</code>\n` +
         `🎲 <b>3D:</b> <code>${details.d3}</code>\n` +
         `🎲 <b>4D:</b> <code>${details.d4}</code>\n` +
         `----------------------------------\n` +
         `✅ <i>Prediksi Telah Diterbitkan!</i>`;
}

function sendTelegramTextMessage(textMessage) {
  return new Promise((resolve) => {
    if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return resolve(null);

    const postData = JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      message_thread_id: TELEGRAM_TOPIC_TEXT_ID,
      text: textMessage,
      parse_mode: 'HTML'
    });

    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${TELEGRAM_TOKEN}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve(body));
    });

    req.on('error', (err) => {
      console.error("[TELEGRAM ERROR - TEXT]:", err.message);
      resolve(null);
    });
    req.write(postData);
    req.end();
  });
}

// ==========================================
// ==========================================
// 6. CANVAS RENDERER PRESISI & FONT JELAS
// ==========================================
async function drawGroupBanner(groupDataArray, templatePath, tanggalFormatted) {
  const fullPath = path.resolve(templatePath);
  const image = await loadImage(fullPath);

  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');

  // Gambar background template
  ctx.drawImage(image, 0, 0, image.width, image.height);

  // Skala responsif terhadap ukuran gambar asli
  const sx = image.width / 1024;
  const sy = image.height / 1280;

  const X = (v) => v * sx;
  const Y = (v) => v * sy;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 1. TANGGAL HEADER (Kotak Hitam Kosong Atas)
  ctx.font = `bold ${Math.round(22 * sy)}px Arial, sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(tanggalFormatted || '', X(438), Y(125));

  // Jarak Antara Panel Kiri ke Panel Kanan
  const RIGHT_SHIFT = 373;

  // POSISI HORIZONTAL (X)
  const LEFT = {
    bbfs: [215, 243, 271, 299, 327],  // 5 Digit Angka BBFS
    cm: 95,                           // Sebelah kanan CM :
    cb: 220,                          // Sebelah kanan CB :
    twin: 325,                        // Sebelah kanan TWIN :
    top2d: [65, 126, 187, 248, 309],  // 5 Pasang Angka TOP 2D
    top3d: [80, 151, 222, 293],       // 4 Pasang Angka TOP 3D
    top4d: [80, 151, 222, 293]        // 4 Pasang Angka TOP 4D
  };

  // BOX TOPS (Tingkat Atas Masing-Masing Baris Panel)
  // Baris 1: Singapore / Malaysia (Top: 152)
  // Baris 2: Macau / Busan Night (Top: 522)
  // Baris 3: Qatar / Hongkong (Top: 892)
  const BOX_TOPS = [152, 522, 892];

  // OFFSET RELATIF DIDALAM KOTAK (Berlaku Sama untuk Semua Baris)
  const OFFSET = {
    bbfs: 122,      // Posisi BBFS 5 Digit
    small: 170,     // Posisi CM, CB, TWIN
    top2d: 218,     // Posisi Garis TOP 2D
    top3d: 268,     // Posisi Garis TOP 3D
    top4d: 318      // Posisi Garis TOP 4D
  };

  groupDataArray.slice(0, 6).forEach((item, index) => {
    const rowIndex = Math.floor(index / 2);
    const isRight = index % 2 === 1;

    const boxTop = BOX_TOPS[rowIndex];
    if (boxTop === undefined) return;

    const shiftX = isRight ? RIGHT_SHIFT : 0;
    const isLibur = item?.bbfs === "LIBUR";
    const details = item?.details || {};

    // Perhitungan Y Presisi berdasarkan Offset
    const yBBFS  = boxTop + OFFSET.bbfs;
    const ySmall = boxTop + OFFSET.small;
    const y2D    = boxTop + OFFSET.top2d;
    const y3D    = boxTop + OFFSET.top3d;
    const y4D    = boxTop + OFFSET.top4d;

    // KONDISI PASARAN LIBUR
    if (isLibur) {
      ctx.fillStyle = '#FF3333';
      ctx.font = `bold ${Math.round(24 * sy)}px Arial, sans-serif`;
      ctx.fillText("PASARAN LIBUR", X(188 + shiftX), Y(y2D));
      return;
    }

    const bbfs = String(item?.bbfs || '').replace(/\D/g, '').slice(0, 5).split('');

    // A. BBFS 5 DIGIT (Putih Bening & Tebal)
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.round(17 * sy)}px Arial, sans-serif`;
    bbfs.forEach((digit, i) => {
      if (LEFT.bbfs[i] !== undefined) {
        ctx.fillText(digit, X(LEFT.bbfs[i] + shiftX), Y(yBBFS));
      }
    });

    // B. CM, CB, TWIN (Kuning Mas Terang)
    ctx.fillStyle = '#FFE600';
    ctx.font = `bold ${Math.round(15 * sy)}px Arial, sans-serif`;
    ctx.fillText(String(details.cm || '-'), X(LEFT.cm + shiftX), Y(ySmall));
    ctx.fillText(String(details.cb || '-'), X(LEFT.cb + shiftX), Y(ySmall));
    ctx.fillText(String(details.twin || '-'), X(LEFT.twin + shiftX), Y(ySmall));

    // C. TOP 2D (Hijau Cyan Terang - Font Diperbesar)
    ctx.fillStyle = '#00FFCC';
    ctx.font = `bold ${Math.round(15 * sy)}px Arial, sans-serif`;
    const d2 = Array.isArray(details.d2Arr) ? details.d2Arr.slice(0, 5) : [];
    d2.forEach((value, i) => {
      if (LEFT.top2d[i] !== undefined && value !== undefined) {
        ctx.fillText(String(value), X(LEFT.top2d[i] + shiftX), Y(y2D));
      }
    });

    // D. TOP 3D (Kuning Terang - Font Diperbesar)
    ctx.fillStyle = '#FFFF00';
    ctx.font = `bold ${Math.round(15 * sy)}px Arial, sans-serif`;
    const d3 = Array.isArray(details.d3Arr) ? details.d3Arr.slice(0, 4) : [];
    d3.forEach((value, i) => {
      if (LEFT.top3d[i] !== undefined && value !== undefined) {
        ctx.fillText(String(value), X(LEFT.top3d[i] + shiftX), Y(y3D));
      }
    });

    // E. TOP 4D (Merah Muda Neon - Font Diperbesar)
    ctx.fillStyle = '#FF77AA';
    ctx.font = `bold ${Math.round(15 * sy)}px Arial, sans-serif`;
    const d4 = Array.isArray(details.d4Arr) ? details.d4Arr.slice(0, 4) : [];
    d4.forEach((value, i) => {
      if (LEFT.top4d[i] !== undefined && value !== undefined) {
        ctx.fillText(String(value), X(LEFT.top4d[i] + shiftX), Y(y4D));
      }
    });
  });

  return canvas.toBuffer('image/png');
}
function sendTelegramBannerPhoto(photoBuffer, captionText) {
  return new Promise((resolve) => {
    if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return resolve(null);

    const form = new FormData();
    const replyMarkup = {
      inline_keyboard: [
        [{ text: "🛡️ LINK UTAMA TARGET4D", url: "https://t4dtop.com/1" }],
        [{ text: "👊😎 BUKTI PASTI CUAN", url: "https://buktijpt4d.com/" }],
        [{ text: "⚙️ FITUR GENERATE POLA AI", url: "https://ramuasli.xyz/kisikisijitu" }],
        [{ text: "🎰 RTP TARGET4D", url: "https://t4dtop.com/rtp" }],
        [{ text: "📅 DAILY CHECKIN", url: "https://duduksala.click/api/" }],
        [{ text: "🎁 MESIN CAPIT TARGET4D", url: "https://t4dtop.com/capit" }],
        [{ text: "📱 APP ANTI BLOKIR", url: "https://t4d.bio/apk%20target4d.apk" }]
      ]
    };

    form.append('chat_id', TELEGRAM_CHAT_ID);
    if (TELEGRAM_TOPIC_GAMBAR_ID) {
      form.append('message_thread_id', TELEGRAM_TOPIC_GAMBAR_ID);
    }

    form.append('photo', photoBuffer, { filename: 'prediksi-banner.png' });
    form.append('caption', captionText);
    form.append('parse_mode', 'HTML');
    form.append('reply_markup', JSON.stringify(replyMarkup));

    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${TELEGRAM_TOKEN}/sendPhoto`,
      method: 'POST',
      headers: form.getHeaders()
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve(body));
    });

    req.on('error', (err) => {
      console.error("[TELEGRAM ERROR - PHOTO]:", err.message);
      resolve(null);
    });

    form.pipe(req);
  });
}

// ==========================================
// 7. EKSEKUSI UTAMA (MAIN BOT FUNCTION)
// ==========================================
async function runBot() {
  const tanggalWIB = getTodayWIB();
  const tanggalFormatted = getFormattedDateWIB();
  const currentDayWIB = getDayOfWeekWIB();

  console.log(`[BOT] Memulai otomatisasi tanggal: ${tanggalWIB} (${tanggalFormatted})`);

  try {
    const botConfigDoc = await db.collection('settings').doc('bot_control').get();
    if (botConfigDoc.exists && botConfigDoc.data().active === false) {
      console.log("[BOT] Status bot OFF. Eksekusi dibatalkan.");
      return;
    }

    const batch = db.batch();
    const prediksiRef = db.collection('prediksi');

    const group1Data = [];
    const group2Data = [];
    const macauGroupData = [];

    const normalize = (str) => String(str || '').replace(/\s+/g, '').toUpperCase();

    const normG1 = KELOMPOK_PASARAN_1.map(normalize);
    const normG2 = KELOMPOK_PASARAN_2.map(normalize);
    const normMacau = KELOMPOK_MACAU.map(normalize);

    for (const pasaran of DAFTAR_PASARAN) {
      const daysOff = JADWAL_OFF[pasaran] || [];
      const isLibur = daysOff.includes(currentDayWIB);

      const bbfs = isLibur ? "LIBUR" : generateBBFS();
      const details = generatePredictionDetails(bbfs);
      const jamInfo = JADWAL_JAM[pasaran] || { tutup: "- WIB", result: "- WIB" };

      const payload = {
        pasaran, 
        tanggal: tanggalWIB, 
        bbfs,
        jamTutup: jamInfo.tutup, 
        jamResult: jamInfo.result,
        colokBebas: details.cb, 
        colok_bebas: details.cb,
        colokMacau: details.cm, 
        colok_macau: details.cm,
        shio: details.shio, 
        twin: details.twin,
        d2: details.d2, 
        d3: details.d3, 
        d4: details.d4,
        createdBy: "BOT_AUTOMATION",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const docId = `${tanggalWIB}_${pasaran.replace(/\s+/g, '')}`;
      batch.set(prediksiRef.doc(docId), payload, { merge: true });

      // Kirim Teks Prediksi ke Topic ID 29
      const textMsg = formatTelegramMessage(pasaran, tanggalFormatted, bbfs, details);
      await sendTelegramTextMessage(textMsg);

      const itemData = { pasaran, bbfs, details };
      const normP = normalize(pasaran);

      if (normMacau.includes(normP)) {
        macauGroupData.push(itemData);
      } else if (normG1.includes(normP)) {
        group1Data.push(itemData);
      } else if (normG2.includes(normP)) {
        group2Data.push(itemData);
      }
    }

    // SIMPAN KE FIRESTORE (UPDATE PANEL & LANDING PAGE)
    await batch.commit();
    console.log(`[BOT] ✅ Firestore & History Panel berhasil diperbarui.`);

    const captionBase = `🎯 <b>PREDIKSI TOGEL ${tanggalFormatted}</b> 🎯\n\n` +
                        `🔥 <b>Angka pilihan hari ini sudah siap!</b>\n` +
                        `💰 BIDIK ANGKA • INCAR JP • KEJAR MENANG 💰\n\n` +
                        `⚡ Prediksi tajam, pilihan terbaik, dan jadwal lengkap berbagai pasaran.\n\n` +
                        `✨ Cek angka pilihanmu dan tetap bermain secara bijak.`;

    // PROSES GAMBAR DENGAN TRY-CATCH INDIVIDUAL
    if (group1Data.length > 0) {
      try {
        const buffer1 = await drawGroupBanner(group1Data, './template-pasaran-1.jpg', tanggalFormatted);
        await sendTelegramBannerPhoto(buffer1, captionBase);
        console.log(`[TELEGRAM] ✅ Banner Pasaran 1 terkirim.`);
      } catch (e) {
        console.error("[ERROR BANNER 1]: Make sure template-pasaran-1.jpg exists.", e.message);
      }
      await delay(2000);
    }

    if (group2Data.length > 0) {
      try {
        const buffer2 = await drawGroupBanner(group2Data, './template-pasaran-2.jpg', tanggalFormatted);
        await sendTelegramBannerPhoto(buffer2, captionBase);
        console.log(`[TELEGRAM] ✅ Banner Pasaran 2 terkirim.`);
      } catch (e) {
        console.error("[ERROR BANNER 2]: Make sure template-pasaran-2.jpg exists.", e.message);
      }
      await delay(2000);
    }

    if (macauGroupData.length > 0) {
      try {
        const buffer3 = await drawGroupBanner(macauGroupData, './template-totomacau.jpg', tanggalFormatted);
        await sendTelegramBannerPhoto(buffer3, captionBase);
        console.log(`[TELEGRAM] ✅ Banner Toto Macau terkirim.`);
      } catch (e) {
        console.error("[ERROR BANNER MACAU]: Make sure template-totomacau.jpg exists.", e.message);
      }
    }

  } catch (error) {
    console.error("[BOT] ❌ Error Utama:", error);
  }
}

runBot();
