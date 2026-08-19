const admin = require('firebase-admin');
const https = require('https');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');
const FormData = require('form-data');

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
const TELEGRAM_TOPIC_TEXT_ID   = process.env.TELEGRAM_TOPIC_TEXT_ID || 29;   // Topic: ANGKO PREDIKSI

// Daftar Pasaran Utama (Total 18 Pasaran)
const DAFTAR_PASARAN = [
  "TOTOWUHAN", "HKSIANG", "SGMETRO", "SYDNEY4D", "TAIPEI", "BUSANDAY",
  "SINGAPORE", "MALAYSIA", "QATAR", "MACAU", "BUSANNIGHT", "HONGKONG",
  "TOTOMACAU 00", "TOTOMACAU 13", "TOTOMACAU 16", "TOTOMACAU 19", 
  "TOTOMACAU 22", "TOTOMACAU 23"
];

// Pemeta Nama Tampilan Khusus Teks Telegram
const MAP_NAMA_DISPLAY = {
  "HKSIANG":      "HONGKONG DAY",
  "TOTOMACAU 00": "TOTO MACAU 0000",
  "TOTOMACAU 13": "TOTO MACAU 1300",
  "TOTOMACAU 16": "TOTO MACAU 1600",
  "TOTOMACAU 19": "TOTO MACAU 1900",
  "TOTOMACAU 22": "TOTO MACAU 2200",
  "TOTOMACAU 23": "TOTO MACAU 2300"
};

// Pembagian Grouping 3 Banner (Masing-masing 6 Pasaran)
const KELOMPOK_MACAU      = ["TOTOMACAU 13", "TOTOMACAU 16", "TOTOMACAU 19", "TOTOMACAU 22", "TOTOMACAU 23", "TOTOMACAU 00"];
const KELOMPOK_PASARAN_1 = ["SINGAPORE", "MALAYSIA", "QATAR", "MACAU", "BUSANNIGHT", "HONGKONG"];
const KELOMPOK_PASARAN_2 = ["TOTOWUHAN", "HKSIANG", "SGMETRO", "SYDNEY4D", "TAIPEI", "BUSANDAY"];

// Jadwal Operasional
const JADWAL_JAM = {
  "TOTOWUHAN":    { tutup: "10:00 WIB", result: "10:30 WIB" },
  "HKSIANG":      { tutup: "10:30 WIB", result: "11:00 WIB" },
  "SGMETRO":      { tutup: "11:30 WIB", result: "12:00 WIB" },
  "SYDNEY4D":     { tutup: "13:35 WIB", result: "14:00 WIB" },
  "TAIPEI":       { tutup: "14:30 WIB", result: "15:00 WIB" },
  "BUSANDAY":     { tutup: "15:00 WIB", result: "15:30 WIB" },
  "SINGAPORE":    { tutup: "17:35 WIB", result: "17:45 WIB" },
  "MALAYSIA":     { tutup: "18:30 WIB", result: "19:00 WIB" },
  "QATAR":        { tutup: "20:00 WIB", result: "20:30 WIB" },
  "MACAU":        { tutup: "21:00 WIB", result: "21:30 WIB" },
  "BUSANNIGHT":   { tutup: "21:30 WIB", result: "22:00 WIB" },
  "HONGKONG":     { tutup: "22:45 WIB", result: "23:00 WIB" },
  "TOTOMACAU 00": { tutup: "23:45 WIB", result: "00:00 WIB" },
  "TOTOMACAU 13": { tutup: "12:45 WIB", result: "13:00 WIB" },
  "TOTOMACAU 16": { tutup: "15:45 WIB", result: "16:00 WIB" },
  "TOTOMACAU 19": { tutup: "18:45 WIB", result: "19:00 WIB" },
  "TOTOMACAU 22": { tutup: "21:45 WIB", result: "22:00 WIB" },
  "TOTOMACAU 23": { tutup: "22:45 WIB", result: "23:00 WIB" }
};

const JADWAL_OFF = {
  "SINGAPORE": [2, 5], 
  "TAIPEI": [1]        
};

const DAFTAR_SHIO = [
  "Tikus", "Kerbau", "Harimau", "Kelinci", "Naga", "Ular", 
  "Kuda", "Kambing", "Monyet", "Ayam", "Anjing", "Babi"
];

// ==========================================
// 3. HELPER DATE & TIME
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
  const arr = bbfsStr.split('');
  const cb = arr[0];
  const cm = `${arr[0]} / ${arr[1]}`;
  const shio = DAFTAR_SHIO[Math.floor(Math.random() * DAFTAR_SHIO.length)];
  const twin = `${arr[0]}${arr[0]} / ${arr[1]}${arr[1]}`;
  
  const d2Arr = [
    `${arr[0]}${arr[1]}`, `${arr[1]}${arr[2]}`, `${arr[2]}${arr[3]}`, 
    `${arr[3]}${arr[4]}`, `${arr[0]}${arr[4]}`, `${arr[1]}${arr[3]}`
  ];
  const d3Arr = getRandomDigitComboArr(arr, 3, 5);
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
// 5. HELPER FORMAT & KIRIM TEKS KE TOPIC "ANGKO PREDIKSI" (ID: 29)
// ==========================================
function formatTelegramMessage(pasaran, tanggal, bbfs, details) {
  const namaTampil = MAP_NAMA_DISPLAY[pasaran] || pasaran;
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
         `✅ <i>Prediksi Otomatis Diterbitkan!</i>`;
}

function sendTelegramTextMessage(textMessage) {
  return new Promise((resolve, reject) => {
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

    req.on('error', (err) => reject(err));
    req.write(postData);
    req.end();
  });
}

// ==========================================
// 6. HELPER CANVAS BANNER TARGET4D
// PRESISI TEMPLATE 1024 x 1280
// ==========================================
async function drawGroupBanner(groupDataArray, templatePath, tanggalFormatted) {
  const image = await loadImage(templatePath);

  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');

  // Gambar template
  ctx.drawImage(image, 0, 0, image.width, image.height);

  // ==========================================
  // AUTO SCALE (Skenario Acuan 1024 x 1280)
  // ==========================================
  const sx = image.width / 1024;
  const sy = image.height / 1280;

  const X = (v) => v * sx;
  const Y = (v) => v * sy;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // ==========================================
  // 1. TANGGAL HEADER (Tepat di pita/kotak hitam)
  // ==========================================
  ctx.font = `bold ${Math.round(26 * sy)}px Arial`;
  ctx.fillStyle = '#FFD700';

  ctx.fillText(
    tanggalFormatted || '',
    X(512), // Tepat di tengah horizontal (1024 / 2)
    Y(118)
  );

  // ==========================================
  // POSISI KOORDINAT X (PANEL KIRI)
  // ==========================================
  const LEFT = {
    // 5 Kotak Emas BBFS
    bbfs: [225, 260, 295, 330, 365],

    cm: 95,
    cb: 222,
    twin: 342,

    // 5 Kotak Top 2D
    top2d: [72, 142, 212, 282, 352],

    // 4 Kotak Top 3D & 4D
    top3d: [105, 177, 248, 319],
    top4d: [105, 177, 248, 319]
  };

  // Pergeseran Horizontal Panel Kanan
  const RIGHT_SHIFT = 370;

  // ==========================================
  // POSISI KOORDINAT Y (3 BARIS / ROWS)
  // ==========================================
  const ROWS = [
    // BARIS 1 (Pasaran 1 & 2)
    {
      bbfs: 223,
      small: 258,
      top2d: 313,
      top3d: 363,
      top4d: 413
    },

    // BARIS 2 (Pasaran 3 & 4)
    {
      bbfs: 518,
      small: 553,
      top2d: 608,
      top3d: 658,
      top4d: 708
    },

    // BARIS 3 (Pasaran 5 & 6)
    {
      bbfs: 813,
      small: 848,
      top2d: 903,
      top3d: 953,
      top4d: 1003
    }
  ];

  // ==========================================
  // LOOPING 6 PASARAN
  // ==========================================
  groupDataArray.slice(0, 6).forEach((item, index) => {
    const rowIndex = Math.floor(index / 2);
    const isRight = index % 2 === 1;

    const row = ROWS[rowIndex];
    if (!row) return;

    const shiftX = isRight ? RIGHT_SHIFT : 0;

    const bbfs = String(item?.bbfs || '')
      .replace(/\D/g, '')
      .slice(0, 5)
      .split('');

    const details = item?.details || {};

    // A. BBFS 5 DIGIT
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.round(18 * sy)}px Arial`;

    bbfs.forEach((digit, i) => {
      const x = LEFT.bbfs[i];
      if (x !== undefined) {
        ctx.fillText(
          digit,
          X(x + shiftX),
          Y(row.bbfs)
        );
      }
    });

    // B. COLOK MACAU (CM)
    ctx.fillStyle = '#FFD700';
    ctx.font = `bold ${Math.round(14 * sy)}px Arial`;

    ctx.fillText(
      String(details.cm || '-'),
      X(LEFT.cm + shiftX),
      Y(row.small)
    );

    // C. COLOK BEBAS (CB)
    ctx.fillText(
      String(details.cb || '-'),
      X(LEFT.cb + shiftX),
      Y(row.small)
    );

    // D. TWIN
    ctx.fillText(
      String(details.twin || '-'),
      X(LEFT.twin + shiftX),
      Y(row.small)
    );

    // E. TOP 2D (Maksimal 5)
    ctx.fillStyle = '#00FFCC';
    ctx.font = `bold ${Math.round(14 * sy)}px Arial`;

    const d2 = Array.isArray(details.d2Arr) ? details.d2Arr.slice(0, 5) : [];
    d2.forEach((value, i) => {
      const x = LEFT.top2d[i];
      if (x !== undefined && value !== undefined) {
        ctx.fillText(
          String(value),
          X(x + shiftX),
          Y(row.top2d)
        );
      }
    });

    // F. TOP 3D (Maksimal 4)
    ctx.fillStyle = '#FFFF00';
    ctx.font = `bold ${Math.round(14 * sy)}px Arial`;

    const d3 = Array.isArray(details.d3Arr) ? details.d3Arr.slice(0, 4) : [];
    d3.forEach((value, i) => {
      const x = LEFT.top3d[i];
      if (x !== undefined && value !== undefined) {
        ctx.fillText(
          String(value),
          X(x + shiftX),
          Y(row.top3d)
        );
      }
    });

    // G. TOP 4D (Maksimal 4)
    ctx.fillStyle = '#FF5555';
    ctx.font = `bold ${Math.round(14 * sy)}px Arial`;

    const d4 = Array.isArray(details.d4Arr) ? details.d4Arr.slice(0, 4) : [];
    d4.forEach((value, i) => {
      const x = LEFT.top4d[i];
      if (x !== undefined && value !== undefined) {
        ctx.fillText(
          String(value),
          X(x + shiftX),
          Y(row.top4d)
        );
      }
    });
  });

  return canvas.toBuffer('image/png');
}

function sendTelegramBannerPhoto(photoBuffer, captionText) {
  return new Promise((resolve, reject) => {
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

    form.append('photo', photoBuffer, { filename: 'prediksi-banner.jpg' });
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

    req.on('error', (err) => reject(err));
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

    for (const pasaran of DAFTAR_PASARAN) {
      const daysOff = JADWAL_OFF[pasaran] || [];
      const isLibur = daysOff.includes(currentDayWIB);

      const bbfs = generateBBFS();
      const details = generatePredictionDetails(bbfs);
      const jamInfo = JADWAL_JAM[pasaran] || { tutup: "- WIB", result: "- WIB" };

      // 1. Simpan ke Firestore jika tidak libur
      if (!isLibur) {
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

        // Kirim Teks Prediksi ke Topic "ANGKO PREDIKSI" (Topic 29)
        const textMsg = formatTelegramMessage(pasaran, tanggalFormatted, bbfs, details);
        await sendTelegramTextMessage(textMsg);
      } else {
        console.log(`[BOT] ⏸️ Pasaran ${pasaran} LIBUR hari ini.`);
      }

      // 2. Kelompokkan Data untuk Gambar Banner (Tetap diisi dummy agar gambar 6 box lengkap)
      const itemData = { pasaran, bbfs: isLibur ? "LIBUR" : bbfs, details };
      if (KELOMPOK_MACAU.includes(pasaran)) macauGroupData.push(itemData);
      if (KELOMPOK_PASARAN_1.includes(pasaran)) group1Data.push(itemData);
      if (KELOMPOK_PASARAN_2.includes(pasaran)) group2Data.push(itemData);
    }

    await batch.commit();
    console.log(`[BOT] ✅ Firestore berhasil diperbarui.`);
    console.log(`[TELEGRAM] ✅ Semua teks prediksi terkirim ke Topic ID 29 (ANGKO PREDIKSI).`);

    const captionBase = `🎯 <b>PREDIKSI TOGEL ${tanggalFormatted}</b> 🎯\n\n` +
                        `🔥 <b>Angka pilihan hari ini sudah siap!</b>\n` +
                        `💰 BIDIK ANGKA • INCAR JP • KEJAR MENANG 💰\n\n` +
                        `⚡ Prediksi tajam, pilihan terbaik, dan jadwal lengkap berbagai pasaran.\n\n` +
                        `✨ Cek angka pilihanmu dan tetap bermain secara bijak.`;

    // 3. Render & Kirim 3 Gambar Banner ke Topic "PREDIKSI GAMBAR TOGEL" (Topic 27)
    if (macauGroupData.length > 0) {
      const buffer = await drawGroupBanner(macauGroupData, './template-totomacau.jpg', tanggalFormatted);
      await sendTelegramBannerPhoto(buffer, captionBase);
      console.log(`[TELEGRAM] ✅ Banner Toto Macau terkirim ke Topic ID 27.`);
    }

    if (group1Data.length > 0) {
      const buffer = await drawGroupBanner(group1Data, './template-pasaran-1.jpg', tanggalFormatted);
      await sendTelegramBannerPhoto(buffer, captionBase);
      console.log(`[TELEGRAM] ✅ Banner Pasaran 1 terkirim ke Topic ID 27.`);
    }

    if (group2Data.length > 0) {
      const buffer = await drawGroupBanner(group2Data, './template-pasaran-2.jpg', tanggalFormatted);
      await sendTelegramBannerPhoto(buffer, captionBase);
      console.log(`[TELEGRAM] ✅ Banner Pasaran 2 terkirim ke Topic ID 27.`);
    }

  } catch (error) {
    console.error("[BOT] ❌ Terjadi kesalahan:", error);
    process.exit(1);
  }
}

runBot();
