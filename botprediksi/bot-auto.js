const admin = require('firebase-admin');

// 1. INISIALISASI FIREBASE ADMIN SDK
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Daftar 18 Pasaran Togel Sesuai Option HTML Admin Anda
const DAFTAR_PASARAN = [
  "TOTOWUHAN", "HKSIANG", "SGMETRO", "SYDNEY4D", "TAIPEI", "BUSANDAY",
  "SINGAPORE", "MALAYSIA", "QATAR", "MACAU", "BUSANNIGHT", "HONGKONG",
  "TOTOMACAU 00", "TOTOMACAU 13", "TOTOMACAU16", "TOTOMACAU19", 
  "TOTOMACAU22", "TOTOMACAU23"
];

// Pemetaan Hari Libur (0 = Minggu, 1 = Senin, 2 = Selasa, 3 = Rabu, 4 = Kamis, 5 = Jumat, 6 = Sabtu)
const JADWAL_OFF = {
  "SINGAPORE": [2, 5], // Libur Selasa (2) & Jumat (5)
  "TAIPEI": [1]        // Libur Senin (1)
  // Pasaran lain yang tidak terdaftar otomatis BUKA setiap hari
};

const DAFTAR_SHIO = [
  "Tikus", "Kerbau", "Harimau", "Kelinci", "Naga", "Ular", 
  "Kuda", "Kambing", "Monyet", "Ayam", "Anjing", "Babi"
];

// Helper: Ambil Tanggal Hari Ini Zona WIB (YYYY-MM-DD)
function getTodayWIB() {
  const options = { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' };
  const formatter = new Intl.DateTimeFormat('en-CA', options);
  return formatter.format(new Date());
}

// Helper: Ambil Angka Hari Saat Ini Berdasarkan Zona WIB (0 = Minggu, 1 = Senin, dst)
function getDayOfWeekWIB() {
  const options = { timeZone: 'Asia/Jakarta', weekday: 'short' };
  const dayStr = new Intl.DateTimeFormat('en-US', options).format(new Date());
  const daysMap = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
  return daysMap[dayStr];
}

// Helper: Acak Angka 5 Digit Unik (BBFS)
function generateBBFS() {
  const digits = [];
  while (digits.length < 5) {
    const rand = Math.floor(Math.random() * 10).toString();
    if (!digits.includes(rand)) {
      digits.push(rand);
    }
  }
  return digits.join('');
}

// Helper: Ambil Kombinasi Digit Secara Acak Tanpa Duplikat
function getRandomDigitCombo(bbfsArr, digitLength, count) {
  const results = new Set();
  let attempts = 0;
  while (results.size < count && attempts < 50) {
    attempts++;
    const shuffled = [...bbfsArr].sort(() => 0.5 - Math.random());
    const combo = shuffled.slice(0, digitLength).join('');
    results.add(combo);
  }
  return Array.from(results).join('*');
}

// Helper: Generator Turunan Angka dari BBFS
function generatePredictionDetails(bbfsStr) {
  const arr = bbfsStr.split('');
  
  const cb = arr[0];
  const cm = `${arr[0]} / ${arr[1]}`;
  const shio = DAFTAR_SHIO[Math.floor(Math.random() * DAFTAR_SHIO.length)];
  const twin = `${arr[0]}${arr[0]}*${arr[1]}${arr[1]}`;
  
  const d2 = `${arr[0]}${arr[1]}*${arr[1]}${arr[2]}*${arr[2]}${arr[3]}*${arr[3]}${arr[4]}*${arr[0]}${arr[4]}`;
  const d3 = getRandomDigitCombo(arr, 3, 5);
  const d4 = getRandomDigitCombo(arr, 4, 5);

  return { cb, cm, shio, twin, d2, d3, d4 };
}

// LOGIKA UTAMA BOT
async function runBot() {
  const tanggalWIB = getTodayWIB();
  const currentDayWIB = getDayOfWeekWIB(); // Dapatkan hari saat ini (0-6)

  console.log(`[BOT] Memulai pengerjaan otomatis pasaran untuk tanggal: ${tanggalWIB} (Hari ke-${currentDayWIB})`);

  try {
    // 1. Cek Aktivasi Bot (Di-OFF-kan / ON-kan via Admin)
    const botConfigDoc = await db.collection('settings').doc('bot_control').get();
    if (botConfigDoc.exists && botConfigDoc.data().active === false) {
      console.log("[BOT] Status bot OFF di admin control. Eksekusi dihentikan.");
      return;
    }

    const batch = db.batch();
    const prediksiRef = db.collection('prediksi');
    let totalGenerated = 0;

    // 2. Loop & Generate Data untuk Pasaran yang Buka
    for (const pasaran of DAFTAR_PASARAN) {
      // Cek apakah pasaran libur/off hari ini
      const daysOff = JADWAL_OFF[pasaran] || [];
      if (daysOff.includes(currentDayWIB)) {
        console.log(`[BOT] ⏸️ Pasaran ${pasaran} LIBUR hari ini. Dilewati.`);
        continue;
      }

      const bbfs = generateBBFS();
      const details = generatePredictionDetails(bbfs);

      const payload = {
        pasaran: pasaran,
        tanggal: tanggalWIB,
        bbfs: bbfs,
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
      const docRef = prediksiRef.doc(docId);
      
      batch.set(docRef, payload, { merge: true });
      totalGenerated++;
    }

    // 3. Commit Semua Pasaran yang Buka ke Firestore
    if (totalGenerated > 0) {
      await batch.commit();
      console.log(`[BOT] ✅ BERHASIL! ${totalGenerated} Pasaran (buka) tanggal ${tanggalWIB} telah diterbitkan.`);
    } else {
      console.log(`[BOT] ⚠️ Tidak ada pasaran yang diterbitkan (semua libur).`);
    }

  } catch (error) {
    console.error("[BOT] ❌ Terjadi kesalahan saat memproses bot:", error);
    process.exit(1);
  }
}

// Jalankan Bot
runBot();
