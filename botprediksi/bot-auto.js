const admin = require('firebase-admin');
const https = require('https');
const fs = require('fs');
const puppeteer = require('puppeteer');
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

function shuffleArray(array) {
  let arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getRandomChar(str) {
  return str[Math.floor(Math.random() * str.length)];
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

  const digits = bbfsStr.split('');

  const cb = getRandomChar(bbfsStr);
  const macauDigits = shuffleArray(digits).slice(0, 2);
  const cm = `${macauDigits[0]} / ${macauDigits[1]}`;
  const shio = DAFTAR_SHIO[Math.floor(Math.random() * DAFTAR_SHIO.length)];
  const twinDigits = shuffleArray(digits).slice(0, 2);
  const twin = `${twinDigits[0]}${twinDigits[0]} / ${twinDigits[1]}${twinDigits[1]}`;

  const set2D = new Set();
  let attempts2D = 0;
  while (set2D.size < 5 && attempts2D < 100) {
    attempts2D++;
    let d1 = getRandomChar(bbfsStr);
    let d2 = getRandomChar(bbfsStr);
    if (d1 !== d2) set2D.add(`${d1}${d2}`);
  }
  const d2Arr = Array.from(set2D);

  const set3D = new Set();
  let attempts3D = 0;
  while (set3D.size < 4 && attempts3D < 100) {
    attempts3D++;
    let combo = getRandomChar(bbfsStr) + getRandomChar(bbfsStr) + getRandomChar(bbfsStr);
    set3D.add(combo);
  }
  const d3Arr = Array.from(set3D);

  const set4D = new Set();
  let attempts4D = 0;
  while (set4D.size < 4 && attempts4D < 100) {
    attempts4D++;
    let combo = getRandomChar(bbfsStr) + getRandomChar(bbfsStr) + getRandomChar(bbfsStr) + getRandomChar(bbfsStr);
    set4D.add(combo);
  }
  const d4Arr = Array.from(set4D);

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
         `✅ <i>Prediksi Mbah Sugeng Telah Di Terbitkan!</i>`;
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
// 6. PUPPETEER BANNER RENDERER (DIPERBAIKI UNTUK 1 HTML MULTI-BANNER)
// ==========================================
async function drawGroupBanner(groupDataArray, templateHtmlPath, tanggalFormatted, bannerId = "banner-1") {
  const fullPath = path.resolve(templateHtmlPath);
  
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File template HTML tidak ditemukan di: ${fullPath}`);
  }

  // Buka Headless Browser (Chrome) via Puppeteer
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 1280, deviceScaleFactor: 2 });
  
  // Buka file template HTML lokal
  await page.goto(`file://${fullPath}`, { waitUntil: 'networkidle0' });

  // Inject Data ke Elemen HTML spesifik berdasarkan Selector ID Banner
  await page.evaluate((dataArray, tgl, mapDisplay, targetBannerId) => {
    const targetBanner = document.getElementById(targetBannerId);
    if (!targetBanner) return;

    // 1. Set Tanggal Header pada banner yang sedang diproses
    const dateBox = targetBanner.querySelector('.date-box');
    if (dateBox) dateBox.innerText = tgl;

    // 2. Set Data 6 Pasaran pada banner yang sedang diproses
    const cards = targetBanner.querySelectorAll('.card-pasaran');
    
    dataArray.slice(0, 6).forEach((item, index) => {
      const card = cards[index];
      if (!card) return;

      const namaDisplay = mapDisplay[item.pasaran] || item.pasaran;

      // Update Judul Pasaran
      const titleElem = card.querySelector('.pasaran-title');
      if (titleElem) titleElem.innerText = namaDisplay;

      const isLibur = item?.bbfs === "LIBUR";
      const details = item?.details || {};

      if (isLibur) {
        card.innerHTML = `
          <div class="pasaran-title">${namaDisplay}</div>
          <div style="color: #ff3333; font-size: 24px; font-weight: bold; text-align: center; margin: auto 0;">
            PASARAN LIBUR
          </div>
        `;
        return;
      }

      // Format BBFS 5 digit
      const rawBbfs = String(item?.bbfs || '').replace(/\D/g, '').slice(0, 5);
      const bbfsFormatted = rawBbfs.split('').join('  ');

      const slots = card.querySelectorAll('.slot-area');
      
      if (slots[0]) slots[0].innerText = bbfsFormatted;
      if (slots[1]) slots[1].innerText = details.cm || '-';
      if (slots[2]) slots[2].innerText = details.cb || '-';
      if (slots[3]) slots[3].innerText = details.twin || '-';
      if (slots[4]) slots[4].innerText = (details.d2Arr || []).join('  ');
      if (slots[5]) slots[5].innerText = (details.d3Arr || []).join('  ');
      if (slots[6]) slots[6].innerText = (details.d4Arr || []).join('  ');
    });
  }, groupDataArray, tanggalFormatted, MAP_NAMA_DISPLAY, bannerId);

  // Ambil Screenshot hanya elemen banner yang ditargetkan (#banner-1, #banner-2, atau #banner-3)
  const bannerElement = await page.$(`#${bannerId}`);
  const imageBuffer = await bannerElement.screenshot({ type: 'png' });

  await browser.close();
  return imageBuffer;
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
    
    console.log("[BOT] Status bot ON. Melanjutkan eksekusi...");

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

    // 1. SIMPAN KE FIRESTORE
    await batch.commit();
    console.log(`[BOT] ✅ Firestore & History Panel berhasil diperbarui.`);

    // 2. KIRIM TEKS KE TELEGRAM
    for (const pasaran of DAFTAR_PASARAN) {
      const daysOff = JADWAL_OFF[pasaran] || [];
      const isLibur = daysOff.includes(currentDayWIB);
      const bbfs = isLibur ? "LIBUR" : (group1Data.concat(group2Data, macauGroupData).find(x => x.pasaran === pasaran)?.bbfs || generateBBFS());
      const details = generatePredictionDetails(bbfs);

      const textMsg = formatTelegramMessage(pasaran, tanggalFormatted, bbfs, details);
      await sendTelegramTextMessage(textMsg);
      await delay(300);
    }
    console.log(`[BOT] ✅ Seluruh teks 18 pasaran terkirim ke Telegram.`);

    const captionBase = `🎯 <b>PREDIKSI TOGEL ${tanggalFormatted}</b> 🎯\n\n` +
                        `🔥 <b>Angka pilihan hari ini sudah siap!</b>\n` +
                        `💰 BIDIK ANGKA • INCAR JP • KEJAR MENANG 💰\n\n` +
                        `⚡ Prediksi tajam, pilihan terbaik, dan jadwal lengkap berbagai pasaran.\n\n` +
                        `✨ Cek angka pilihanmu dan tetap bermain secara bijak.`;

    // Path mengarah ke file template HTML gabungan Anda
    const templateHtmlPath = path.join(__dirname, 'template.html');

    // 3. PROSES BANNER GAMBAR VIA PUPPETEER (MENGGUNAKAN ID UNIK)
    if (group1Data.length > 0) {
      try {
        const buffer1 = await drawGroupBanner(group1Data, templateHtmlPath, tanggalFormatted, 'banner-1');
        await sendTelegramBannerPhoto(buffer1, captionBase);
        console.log(`[TELEGRAM] ✅ Banner Pasaran 1 terkirim.`);
      } catch (e) {
        console.error("[ERROR BANNER 1]:", e.message);
      }
      await delay(2000);
    }

    if (group2Data.length > 0) {
      try {
        const buffer2 = await drawGroupBanner(group2Data, templateHtmlPath, tanggalFormatted, 'banner-2');
        await sendTelegramBannerPhoto(buffer2, captionBase);
        console.log(`[TELEGRAM] ✅ Banner Pasaran 2 terkirim.`);
      } catch (e) {
        console.error("[ERROR BANNER 2]:", e.message);
      }
      await delay(2000);
    }

    if (macauGroupData.length > 0) {
      try {
        const buffer3 = await drawGroupBanner(macauGroupData, templateHtmlPath, tanggalFormatted, 'banner-3');
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
