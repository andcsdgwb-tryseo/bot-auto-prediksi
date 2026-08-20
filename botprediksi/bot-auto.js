const admin = require('firebase-admin');
const https = require('https');
const fs = require('fs'); // FIXED: Tambahkan require('fs') agar tidak crash saat cek template
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
         `✅ <i>Prediksi Otomatis Diterbitkan!</i>`;
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
// 6. CANVAS RENDERER PRESISI & JELAS
// ==========================================
async function drawGroupBanner(groupDataArray, templatePath, tanggalFormatted) {
  const fullPath = path.resolve(templatePath);
  
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File template tidak ditemukan di: ${fullPath}`);
  }

  const image = await loadImage(fullPath);

  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');

  // Gambar latar template dasar
  ctx.drawImage(image, 0, 0, image.width, image.height);

  // Skala responsif terhadap canvas asli (1024x1280)
  const sx = image.width / 1024;
  const sy = image.height / 1280;

  const X = (v) => v * sx;
  const Y = (v) => v * sy;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 1. TANGGAL HEADER (Di Kotak Hitam Atas)
  ctx.font = `bold ${Math.round(20 * sy)}px Arial, sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(tanggalFormatted || '', X(438), Y(102));

  // Jarak Horisontal Panel Kiri ke Panel Kanan (SINGAPORE -> MALAYSIA)
  const RIGHT_SHIFT = 373;

  // KOORDINAT HORIZONTAL (X) PANEL KIRI
  const LEFT = {
    bbfs: [215, 238, 261, 284, 307], // 5 Digit BBFS (Pas di samping "BBFS 5 Digit:")
    cm: 88,                          // Angka CM (Di samping "CM :")
    cb: 198,                         // Angka CB (Di samping "CB :")
    twin: 308,                       // Angka TWIN (Di samping "TWIN :")
    top2d: [62, 124, 186, 248, 310], // 5 Pasang Angka TOP 2D
    top3d: [78, 150, 222, 294],      // 4 Pasang Angka TOP 3D
    top4d: [78, 150, 222, 294]       // 4 Pasang Angka TOP 4D
  };

  // KOORDINAT VERTIKAL (Y) TIAP BARIS PASARAN
  const ROWS = [
    // Baris 1: SINGAPORE / MALAYSIA
    { bbfs: 220, small: 254, top2d: 302, top3d: 356, top4d: 410 },
    // Baris 2: MACAU / BUSAN NIGHT
    { bbfs: 478, small: 512, top2d: 560, top3d: 614, top4d: 668 },
    // Baris 3: QATAR / HONGKONG
    { bbfs: 736, small: 770, top2d: 818, top3d: 872, top4d: 926 }
  ];

  groupDataArray.slice(0, 6).forEach((item, index) => {
    const rowIndex = Math.floor(index / 2);
    const isRight = index % 2 === 1;

    const row = ROWS[rowIndex];
    if (!row) return;

    const shiftX = isRight ? RIGHT_SHIFT : 0;
    const isLibur = item?.bbfs === "LIBUR";
    const details = item?.details || {};

    // STATUS LIBUR
    if (isLibur) {
      ctx.fillStyle = '#FF3333';
      ctx.font = `bold ${Math.round(24 * sy)}px Arial, sans-serif`;
      ctx.fillText("PASARAN LIBUR", X(188 + shiftX), Y(row.top2d));
      return;
    }

    const bbfs = String(item?.bbfs || '').replace(/\D/g, '').slice(0, 5).split('');

    // A. BBFS 5 DIGIT (Putih Tajam)
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.round(15 * sy)}px Arial, sans-serif`;
    bbfs.forEach((digit, i) => {
      if (LEFT.bbfs[i] !== undefined) {
        ctx.fillText(digit, X(LEFT.bbfs[i] + shiftX), Y(row.bbfs));
      }
    });

    // B. CM, CB, TWIN (Kuning Mas)
    ctx.fillStyle = '#FFD700';
    ctx.font = `bold ${Math.round(13 * sy)}px Arial, sans-serif`;
    ctx.fillText(String(details.cm || '-'), X(LEFT.cm + shiftX), Y(row.small));
    ctx.fillText(String(details.cb || '-'), X(LEFT.cb + shiftX), Y(row.small));
    ctx.fillText(String(details.twin || '-'), X(LEFT.twin + shiftX), Y(row.small));

    // C. TOP 2D (Cyan / Hijau Tosca)
    ctx.fillStyle = '#00FFCC';
    ctx.font = `bold ${Math.round(13 * sy)}px Arial, sans-serif`;
    const d2 = Array.isArray(details.d2Arr) ? details.d2Arr.slice(0, 5) : [];
    d2.forEach((value, i) => {
      if (LEFT.top2d[i] !== undefined && value !== undefined) {
        ctx.fillText(String(value), X(LEFT.top2d[i] + shiftX), Y(row.top2d));
      }
    });

    // D. TOP 3D (Kuning Neon)
    ctx.fillStyle = '#FFFF00';
    ctx.font = `bold ${Math.round(13 * sy)}px Arial, sans-serif`;
    const d3 = Array.isArray(details.d3Arr) ? details.d3Arr.slice(0, 4) : [];
    d3.forEach((value, i) => {
      if (LEFT.top3d[i] !== undefined && value !== undefined) {
        ctx.fillText(String(value), X(LEFT.top3d[i] + shiftX), Y(row.top3d));
      }
    });

    // E. TOP 4D (Merah Muda / Coral)
    ctx.fillStyle = '#FF77AA';
    ctx.font = `bold ${Math.round(13 * sy)}px Arial, sans-serif`;
    const d4 = Array.isArray(details.d4Arr) ? details.d4Arr.slice(0, 4) : [];
    d4.forEach((value, i) => {
      if (LEFT.top4d[i] !== undefined && value !== undefined) {
        ctx.fillText(String(value), X(LEFT.top4d[i] + shiftX), Y(row.top4d));
      }
    });
  });

  return canvas.toBuffer('image/png');
}

function sendTelegramBannerPhoto(photoBuffer, captionText) {
  return new Promise((resolve, reject) => {
    if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
      console.error("[TELEGRAM ERROR]: Token atau Chat ID belum dikonfigurasi.");
      return resolve(null);
    }

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
      res.on('end', () => {
        try {
          const resObj = JSON.parse(body);
          if (!resObj.ok) {
            console.error("[TELEGRAM API REJECTED]:", resObj.description);
          }
        } catch (e) {}
        resolve(body);
      });
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

    // SIMPAN KE FIRESTORE
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
        console.error("[ERROR BANNER 1]:", e.message);
      }
      await delay(2000);
    }

    if (group2Data.length > 0) {
      try {
        const buffer2 = await drawGroupBanner(group2Data, './template-pasaran-2.jpg', tanggalFormatted);
        await sendTelegramBannerPhoto(buffer2, captionBase);
        console.log(`[TELEGRAM] ✅ Banner Pasaran 2 terkirim.`);
      } catch (e) {
        console.error("[ERROR BANNER 2]:", e.message);
      }
      await delay(2000);
    }

    if (macauGroupData.length > 0) {
      try {
        const buffer3 = await drawGroupBanner(macauGroupData, './template-totomacau.jpg', tanggalFormatted);
        await sendTelegramBannerPhoto(buffer3, captionBase);
        console.log(`[TELEGRAM] ✅ Banner Toto Macau terkirim.`);
      } catch (e) {
        console.error("[ERROR BANNER MACAU]:", e.message);
      }
    }

  } catch (error) {
    console.error("[BOT] ❌ Error Utama:", error);
  }
}

runBot();
