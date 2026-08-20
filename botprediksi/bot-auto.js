const admin = require('firebase-admin');
const https = require('https');
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

// Kelompok Pasaran
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
  "SINGAPORE": [2, 5], 
  "TAIPEI": [1]        
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
// 5. HELPER FORMAT & KIRIM TEKS TOPIC 29
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
// 6. CANVAS RENDERER UNTUK TEMPLATE BARU
// ==========================================
async function drawGroupBanner(groupDataArray, templatePath, tanggalFormatted) {
  const image = await loadImage(templatePath);

  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');

  ctx.drawImage(image, 0, 0, image.width, image.height);

  // Skala responsif berdasarkan ukuran asli image
  const sx = image.width / 1024;
  const sy = image.height / 1280;

  const X = (v) => v * sx;
  const Y = (v) => v * sy;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 1. TANGGAL HEADER ATAS (Kotak Hitam Atas)
  ctx.font = `bold ${Math.round(22 * sy)}px Arial`;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(tanggalFormatted || '', X(450), Y(106));

  // Jarak Antara Panel Kiri dan Panel Kanan
  const RIGHT_SHIFT = 373;

  // KOORDINAT X SISI KIRI (Panel Kiri)
  const LEFT = {
    bbfs: [214, 240, 266, 292, 318], // 5 Digit BBFS
    cm: 80,                          // CM
    cb: 185,                         // CB
    twin: 295,                       // TWIN
    top2d: [95, 195, 295],           // 3 Posisi TOP 2D
    top3d: [145, 245],               // 2 Posisi TOP 3D
    top4d: 195                       // 1 Posisi TOP 4D
  };

  // KOORDINAT Y TIGA BARIS PASARAN
  const ROWS = [
    { bbfs: 216, small: 247, top2d: 293, top3d: 339, top4d: 384 }, // Baris 1
    { bbfs: 512, small: 543, top2d: 589, top3d: 635, top4d: 680 }, // Baris 2
    { bbfs: 808, small: 839, top2d: 885, top3d: 931, top4d: 976 }  // Baris 3
  ];

  groupDataArray.slice(0, 6).forEach((item, index) => {
    const rowIndex = Math.floor(index / 2);
    const isRight = index % 2 === 1;

    const row = ROWS[rowIndex];
    if (!row) return;

    const shiftX = isRight ? RIGHT_SHIFT : 0;
    const bbfs = String(item?.bbfs || '').replace(/\D/g, '').slice(0, 5).split('');
    const details = item?.details || {};

    // 1. BBFS (5 Digit)
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.round(15 * sy)}px Arial`;
    bbfs.forEach((digit, i) => {
      if (LEFT.bbfs[i] !== undefined) {
        ctx.fillText(digit, X(LEFT.bbfs[i] + shiftX), Y(row.bbfs));
      }
    });

    // 2. CM, CB, TWIN
    ctx.fillStyle = '#E6C280'; // Warna Emas / Khaki
    ctx.font = `bold ${Math.round(13 * sy)}px Arial`;
    ctx.fillText(String(details.cm || '-'), X(LEFT.cm + shiftX), Y(row.small));
    ctx.fillText(String(details.cb || '-'), X(LEFT.cb + shiftX), Y(row.small));
    ctx.fillText(String(details.twin || '-'), X(LEFT.twin + shiftX), Y(row.small));

    // 3. TOP 2D (3 Angka)
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.round(13 * sy)}px Arial`;
    const d2 = Array.isArray(details.d2Arr) ? details.d2Arr.slice(0, 3) : [];
    d2.forEach((value, i) => {
      if (LEFT.top2d[i] !== undefined && value !== undefined) {
        ctx.fillText(String(value), X(LEFT.top2d[i] + shiftX), Y(row.top2d));
      }
    });

    // 4. TOP 3D (2 Angka)
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.round(13 * sy)}px Arial`;
    const d3 = Array.isArray(details.d3Arr) ? details.d3Arr.slice(0, 2) : [];
    d3.forEach((value, i) => {
      if (LEFT.top3d[i] !== undefined && value !== undefined) {
        ctx.fillText(String(value), X(LEFT.top3d[i] + shiftX), Y(row.top3d));
      }
    });

    // 5. TOP 4D (1 Angka)
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.round(13 * sy)}px Arial`;
    const d4 = Array.isArray(details.d4Arr) ? details.d4Arr[0] : '-';
    if (d4 !== undefined) {
      ctx.fillText(String(d4), X(LEFT.top4d + shiftX), Y(row.top4d));
    }
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

    // Helper Pencocokan Fleksibel String
    const normalize = (str) => String(str || '').replace(/\s+/g, '').toUpperCase();

    const normG1 = KELOMPOK_PASARAN_1.map(normalize);
    const normG2 = KELOMPOK_PASARAN_2.map(normalize);
    const normMacau = KELOMPOK_MACAU.map(normalize);

    for (const pasaran of DAFTAR_PASARAN) {
      const daysOff = JADWAL_OFF[pasaran] || [];
      const isLibur = daysOff.includes(currentDayWIB);

      const bbfs = generateBBFS();
      const details = generatePredictionDetails(bbfs);
      const jamInfo = JADWAL_JAM[pasaran] || { tutup: "- WIB", result: "- WIB" };

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

        // Kirim Teks Prediksi ke Topic ID 29
        const textMsg = formatTelegramMessage(pasaran, tanggalFormatted, bbfs, details);
        await sendTelegramTextMessage(textMsg);
      }

      const itemData = { pasaran, bbfs: isLibur ? "LIBUR" : bbfs, details };

      const normP = normalize(pasaran);

      if (normMacau.includes(normP)) {
        macauGroupData.push(itemData);
      } else if (normG1.includes(normP)) {
        group1Data.push(itemData);
      } else if (normG2.includes(normP)) {
        group2Data.push(itemData);
      }
    }

    await batch.commit();
    console.log(`[BOT] ✅ Firestore & Teks Topic 29 selesai.`);
    console.log(`[DIAGNOSTIK] Banner 1: ${group1Data.length} | Banner 2: ${group2Data.length} | Banner Macau: ${macauGroupData.length}`);

    const captionBase = `🎯 <b>PREDIKSI TOGEL ${tanggalFormatted}</b> 🎯\n\n` +
                        `🔥 <b>Angka pilihan hari ini sudah siap!</b>\n` +
                        `💰 BIDIK ANGKA • INCAR JP • KEJAR MENANG 💰\n\n` +
                        `⚡ Prediksi tajam, pilihan terbaik, dan jadwal lengkap berbagai pasaran.\n\n` +
                        `✨ Cek angka pilihanmu dan tetap bermain secara bijak.`;

    // 3. RENDER & SEND 3 BANNER KE TOPIC 27 DENGAN JEDA (DELAY)

    if (group1Data.length > 0) {
      const buffer1 = await drawGroupBanner(group1Data, './template-pasaran-1.jpg', tanggalFormatted);
      await sendTelegramBannerPhoto(buffer1, captionBase);
      console.log(`[TELEGRAM] ✅ Banner Pasaran 1 terkirim ke Topic ID 27.`);
      await delay(2500);
    }

    if (group2Data.length > 0) {
      const buffer2 = await drawGroupBanner(group2Data, './template-pasaran-2.jpg', tanggalFormatted);
      await sendTelegramBannerPhoto(buffer2, captionBase);
      console.log(`[TELEGRAM] ✅ Banner Pasaran 2 terkirim ke Topic ID 27.`);
      await delay(2500);
    }

    if (macauGroupData.length > 0) {
      const buffer3 = await drawGroupBanner(macauGroupData, './template-totomacau.jpg', tanggalFormatted);
      await sendTelegramBannerPhoto(buffer3, captionBase);
      console.log(`[TELEGRAM] ✅ Banner Toto Macau terkirim ke Topic ID 27.`);
    }

  } catch (error) {
    console.error("[BOT] ❌ Terjadi kesalahan:", error);
    process.exit(1);
  }
}

runBot();
