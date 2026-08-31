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
// --- GRUP UTAMA (GRUP 1) ---
const TELEGRAM_TOKEN           = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID         = process.env.TELEGRAM_CHAT_ID || "-1004474947415";
const TELEGRAM_TOPIC_GAMBAR_ID = process.env.TELEGRAM_TOPIC_GAMBAR_ID || 27; // Topic: PREDIKSI GAMBAR TOGEL
const TELEGRAM_TOPIC_TEXT_ID   = process.env.TELEGRAM_TOPIC_TEXT_ID || 29;   // Topic: ANGKA PREDIKSI

// --- GRUP KEDUA (GRUP 2) ---
const TELEGRAM_CHAT_ID_2         = process.env.TELEGRAM_CHAT_ID_2 || "-1002005725423"; 
const TELEGRAM_TOPIC_GAMBAR_2_ID = process.env.TELEGRAM_TOPIC_GAMBAR_2_ID || 58762;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Urutan Presisi 18 Pasaran
const DAFTAR_PASARAN = [
  "TOTOWUHAN", "HKSIANG", "SYDNEY4D", "TAIPEI", "SGMETRO", "BUSANDAY",
  "SINGAPORE", "MALAYSIA", "MACAU", "BUSANNIGHT", "QATAR", "HONGKONG",
  "TOTOMACAU 00", "TOTOMACAU 13", "TOTOMACAU 16", "TOTOMACAU 19", 
  "TOTOMACAU 22", "TOTOMACAU 23"
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
const KELOMPOK_MACAU      = ["TOTOMACAU 00", "TOTOMACAU 13", "TOTOMACAU 16", "TOTOMACAU 19", "TOTOMACAU 22", "TOTOMACAU 23"];

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

  const set3D = new Set();
  let attempts3D = 0;
  while (set3D.size < 4 && attempts3D < 100) {
    attempts3D++;
    let combo = getRandomChar(bbfsStr) + getRandomChar(bbfsStr) + getRandomChar(bbfsStr);
    set3D.add(combo);
  }

  const set4D = new Set();
  let attempts4D = 0;
  while (set4D.size < 4 && attempts4D < 100) {
    attempts4D++;
    let combo = getRandomChar(bbfsStr) + getRandomChar(bbfsStr) + getRandomChar(bbfsStr) + getRandomChar(bbfsStr);
    set4D.add(combo);
  }

  return { 
    cb, cm, shio, twin, 
    d2Arr: Array.from(set2D), 
    d3Arr: Array.from(set3D), 
    d4Arr: Array.from(set4D),
    d2: Array.from(set2D).join('*'),
    d3: Array.from(set3D).join('*'),
    d4: Array.from(set4D).join('*')
  };
}

// ==========================================
// 5. HELPER FORMAT & KIRIM TEKS/GAMBAR TELEGRAM
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

function sendTelegramTextMessage(textMessage, targetChatId = null, targetTopicId = null) {
  return new Promise((resolve) => {
    const chatId = targetChatId || TELEGRAM_CHAT_ID;
    const topicId = targetTopicId || TELEGRAM_TOPIC_TEXT_ID;

    if (!TELEGRAM_TOKEN || !chatId) return resolve(null);

    const payload = {
      chat_id: chatId,
      text: textMessage,
      parse_mode: 'HTML'
    };

    if (topicId) payload.message_thread_id = topicId;

    const postData = JSON.stringify(payload);
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

// KIRIM GAMBAR DENGAN DUKUNGAN FILE_ID ATAU BUFFER
function sendTelegramBannerPhoto(photoSource, captionText, targetChatId = null, targetTopicId = null) {
  return new Promise((resolve) => {
    const chatId = targetChatId || TELEGRAM_CHAT_ID;
    const topicId = targetTopicId || TELEGRAM_TOPIC_GAMBAR_ID;

    if (!TELEGRAM_TOKEN || !chatId) {
      console.error("[TELEGRAM ERROR]: Token atau Chat ID belum dikonfigurasi.");
      return resolve(null);
    }

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

    // OPSIONAL A: JIKA MENGGUNAKAN FILE_ID (SANGAT CEPAT - INSTAN)
    if (typeof photoSource === 'string') {
      const payload = {
        chat_id: chatId,
        photo: photoSource,
        caption: captionText,
        parse_mode: 'HTML',
        reply_markup: replyMarkup
      };
      if (topicId) payload.message_thread_id = topicId;

      const postData = JSON.stringify(payload);
      const options = {
        hostname: 'api.telegram.org',
        path: `/bot${TELEGRAM_TOKEN}/sendPhoto`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(body)); } catch (e) { resolve(null); }
        });
      });
      req.on('error', () => resolve(null));
      req.write(postData);
      req.end();

    } else {
      // OPSIONAL B: JIKA MENGGUNAKAN BUFFER GAMBAR (UPLOAD FILE BARU)
      const form = new FormData();
      form.append('chat_id', chatId);
      if (topicId) form.append('message_thread_id', topicId);

      form.append('photo', photoSource, { filename: 'prediksi-banner.png' });
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
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(body)); } catch (e) { resolve(null); }
        });
      });

      req.on('error', (err) => {
        console.error("[TELEGRAM ERROR - PHOTO]:", err.message);
        resolve(null);
      });

      form.pipe(req);
    }
  });
}

// ==========================================
// 6. PUPPETEER MULTI-BANNER RENDERER
// ==========================================
async function renderAllBannersAndGetBuffers(allGroups, templateHtmlPath, tanggalFormatted) {
  const fullPath = path.resolve(templateHtmlPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File template HTML tidak ditemukan di: ${fullPath}`);
  }

  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox'
    ]
  });

  const page = await browser.newPage();
  // DIUBAH: deviceScaleFactor menjadi 2 agar ukuran file kecil dan render kencang
  await page.setViewport({ width: 1200, height: 1500, deviceScaleFactor: 2 });
  await page.goto(`file://${fullPath}`, { waitUntil: 'networkidle0' });

  await page.evaluate((groups, tgl, mapDisplay) => {
    groups.forEach(({ bannerId, data }) => {
      const targetBanner = document.getElementById(bannerId);
      if (!targetBanner) return;

      const dateBox = targetBanner.querySelector('.date-box');
      if (dateBox) dateBox.innerText = tgl;

      const cards = targetBanner.querySelectorAll('.card-pasaran');
      data.slice(0, 6).forEach((item, index) => {
        const card = cards[index];
        if (!card) return;

        const namaDisplay = mapDisplay[item.pasaran] || item.pasaran;
        const titleElem = card.querySelector('.pasaran-title');
        if (titleElem) titleElem.innerText = namaDisplay;

        if (item.bbfs === "LIBUR") {
          card.innerHTML = `
            <div class="pasaran-title">${namaDisplay}</div>
            <div style="color: #ff3333; font-size: 24px; font-weight: bold; text-align: center; margin: auto 0;">
              PASARAN LIBUR
            </div>
          `;
          return;
        }

        const rawBbfs = String(item.bbfs || '').replace(/\D/g, '').slice(0, 5);
        const bbfsFormatted = rawBbfs.split('').join('  ');
        const slots = card.querySelectorAll('.slot-area');
        const details = item.details || {};

        if (slots[0]) slots[0].innerText = bbfsFormatted;
        if (slots[1]) slots[1].innerText = details.cm || '-';
        if (slots[2]) slots[2].innerText = details.cb || '-';
        if (slots[3]) slots[3].innerText = details.twin || '-';
        if (slots[4]) slots[4].innerText = (details.d2Arr || []).join('  ');
        if (slots[5]) slots[5].innerText = (details.d3Arr || []).join('  ');
        if (slots[6]) slots[6].innerText = (details.d4Arr || []).join('  ');
      });
    });
  }, allGroups, tanggalFormatted, MAP_NAMA_DISPLAY);

  const imageBuffers = [];
  for (const group of allGroups) {
    const bannerElement = await page.$(`#${group.bannerId}`);
    if (bannerElement) {
      const buffer = await bannerElement.screenshot({ type: 'png', omitBackground: false });
      imageBuffers.push({ bannerId: group.bannerId, buffer });
    } else {
      console.error(`[PUPPETEER ERROR] Element #${group.bannerId} tidak ditemukan!`);
    }
  }

  await browser.close();
  return imageBuffers;
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
    const allPredictionsMap = {};

    // BACA / INPUT DATA FIRESTORE
    for (const pasaran of DAFTAR_PASARAN) {
      const docId = `${tanggalWIB}_${pasaran.replace(/\s+/g, '')}`;
      const docSnap = await prediksiRef.doc(docId).get();

      let bbfs, details, jamInfo;

      if (docSnap.exists) {
        const dataExist = docSnap.data();
        bbfs = dataExist.bbfs || "LIBUR";
        jamInfo = { tutup: dataExist.jamTutup || "- WIB", result: dataExist.jamResult || "- WIB" };

        details = {
          cb: dataExist.colokBebas || dataExist.colok_bebas || '-',
          cm: dataExist.colokMacau || dataExist.colok_macau || '-',
          shio: dataExist.shio || '-',
          twin: dataExist.twin || '-',
          d2: dataExist.d2 || '-',
          d3: dataExist.d3 || '-',
          d4: dataExist.d4 || '-',
          d2Arr: typeof dataExist.d2 === 'string' ? dataExist.d2.split('*') : [],
          d3Arr: typeof dataExist.d3 === 'string' ? dataExist.d3.split('*') : [],
          d4Arr: typeof dataExist.d4 === 'string' ? dataExist.d4.split('*') : []
        };
      } else {
        const daysOff = JADWAL_OFF[pasaran] || [];
        const isLibur = daysOff.includes(currentDayWIB);

        bbfs = isLibur ? "LIBUR" : generateBBFS();
        details = generatePredictionDetails(bbfs);
        jamInfo = JADWAL_JAM[pasaran] || { tutup: "- WIB", result: "- WIB" };

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

        batch.set(prediksiRef.doc(docId), payload, { merge: true });
      }

      allPredictionsMap[pasaran] = { pasaran, bbfs, details };
    }

    await batch.commit();
    console.log(`[BOT] ✅ Firestore & History Panel terverifikasi sinkron.`);

    // ----------------------------------------------------
    // PROSES 1: KIRIM TEKS HANYA KE GRUP 1 (UTAMA)
    // ----------------------------------------------------
    for (const pasaran of DAFTAR_PASARAN) {
      const pred = allPredictionsMap[pasaran];
      const textMsg = formatTelegramMessage(pasaran, tanggalFormatted, pred.bbfs, pred.details);
      
      await sendTelegramTextMessage(textMsg, TELEGRAM_CHAT_ID, TELEGRAM_TOPIC_TEXT_ID);
      await delay(50); // Jeda diperkecil jadi 50ms
    }
    console.log(`[BOT] ✅ Seluruh teks 18 pasaran terkirim ke Grup Utama.`);

    // ----------------------------------------------------
    // PROSES 2: RENDER BANNER GAMBAR
    // ----------------------------------------------------
    const group1Data = KELOMPOK_PASARAN_1.map(p => allPredictionsMap[p]).filter(Boolean);
    const group2Data = KELOMPOK_PASARAN_2.map(p => allPredictionsMap[p]).filter(Boolean);
    const macauGroupData = KELOMPOK_MACAU.map(p => allPredictionsMap[p]).filter(Boolean);

    const captionBase = `🎯 <b>PREDIKSI TOGEL ${tanggalFormatted}</b> 🎯\n\n` +
                        `🔥 <b>Angka pilihan hari ini sudah siap!</b>\n` +
                        `💰 BIDIK ANGKA • INCAR JP • KEJAR MENANG 💰\n\n` +
                        `⚡ Prediksi tajam, pilihan terbaik, dan jadwal lengkap berbagai pasaran.\n\n` +
                        `✨ Cek angka pilihanmu dan tetap bermain secara bijak.`;

    const templateHtmlPath = path.join(__dirname, 'template.html');

    const allGroups = [
      { bannerId: 'banner-1', data: group1Data },
      { bannerId: 'banner-2', data: group2Data },
      { bannerId: 'banner-3', data: macauGroupData }
    ];

    console.log(`[BOT] Memulai render 3 banner...`);
    const renderedBanners = await renderAllBannersAndGetBuffers(allGroups, templateHtmlPath, tanggalFormatted);

    // ----------------------------------------------------
    // PROSES 3: KIRIM GAMBAR (OPTIMASI TERCEPAT VIA FILE_ID)
    // ----------------------------------------------------
    for (const item of renderedBanners) {
      // 1. Upload Buffer Ke Grup Utama
      const res1 = await sendTelegramBannerPhoto(item.buffer, captionBase, TELEGRAM_CHAT_ID, TELEGRAM_TOPIC_GAMBAR_ID);
      
      let fileId = null;
      if (res1 && res1.ok && res1.result && res1.result.photo) {
        // Ambil ID foto ukuran terbesar
        const photos = res1.result.photo;
        fileId = photos[photos.length - 1].file_id;
        console.log(`[TELEGRAM] ✅ Gambar ${item.bannerId} terkirim ke Grup Utama.`);
      } else {
        console.error(`[TELEGRAM ERROR] ❌ Gagal kirim ${item.bannerId} ke Grup Utama.`);
      }

      // 2. Kirim Ke Grup 2 Menggunakan File ID (Instan)
      if (fileId) {
        const res2 = await sendTelegramBannerPhoto(fileId, captionBase, TELEGRAM_CHAT_ID_2, TELEGRAM_TOPIC_GAMBAR_2_ID);
        if (res2 && res2.ok) {
          console.log(`[TELEGRAM] ✅ Gambar ${item.bannerId} terkirim ke Grup 2 (Instan via file_id).`);
        }
      } else {
        // Fallback jika fileId gagal diambil
        await sendTelegramBannerPhoto(item.buffer, captionBase, TELEGRAM_CHAT_ID_2, TELEGRAM_TOPIC_GAMBAR_2_ID);
      }

      await delay(500); // Jeda singkat antar banner
    }

    console.log("[BOT] ✅ SELURUH PROSES BERHASIL SELESAI!");

  } catch (error) {
    console.error("[BOT] ❌ Error Utama:", error);
  }
}

runBot();
