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

// Helper: Generator Turunan Angka dari BBFS
function generatePredictionDetails(bbfsStr) {
  const arr = bbfsStr.split('');
  
  // Colok Bebas (1 Digit dari BBFS)
  const cb = arr[0];
  
  // Colok Macau (2 Digit dari BBFS)
  const cm = `${arr[0]} / ${arr[1]}`;
  
  // Shio & Twin Random
  const shio = DAFTAR_SHIO[Math.floor(Math.random() * DAFTAR_SHIO.length)];
  const twin = `${arr[0]}${arr[0]}*${arr[1]}${arr[1]}`;
  
  // Kombinasi 2D, 3D, 4D dari BBFS
  const d2 = `${arr[0]}${arr[1]}*${arr[1]}${arr[2]}*${arr[2]}${arr[3]}*${arr[3]}${arr[4]}*${arr[0]}${arr[4]}`;
  const d3 = `${arr[0]}${arr[1]}${arr[2]}*${arr[1]}${arr[2]}${arr[3]}*${arr[2]}${arr[3]}${arr[4]}`;
  const d4 = `${arr[0]}${arr[1]}${arr[2]}${arr[3]}*${arr[1]}${arr[2]}${arr[3]}${arr[4]}`;

  return { cb, cm, shio, twin, d2, d3, d4 };
}

// LOGIKA UTAMA BOT
async function runBot() {
  const tanggalWIB = getTodayWIB();
  console.log(`[BOT] Memulai pengerjaan otomatis 18 pasaran untuk tanggal: ${tanggalWIB}`);

  try {
    // 1. Cek Aktivasi Bot (Di-OFF-kan / ON-kan via Admin)
    const botConfigDoc = await db.collection('settings').doc('bot_config').get();
    if (botConfigDoc.exists && botConfigDoc.data().is_active === false) {
      console.log("[BOT] Status bot OFF di admin setting. Eksekusi dihentikan.");
      return;
    }

    const batch = db.batch();
    const prediksiRef = db.collection('prediksi');

    // 2. Loop & Generate Data untuk 18 Pasaran
    for (const pasaran of DAFTAR_PASARAN) {
      const bbfs = generateBBFS();
      const details = generatePredictionDetails(bbfs);

      // Struktur Data 100% Persis dengan save-prediksi.js Anda
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

      // Simpan menggunakan ID gabungan (contoh: "2026-08-20_HONGKONG")
      // Menggunakan set + merge agar tidak duplikat jika di-run berulang kali
      const docId = `${tanggalWIB}_${pasaran.replace(/\s+/g, '')}`;
      const docRef = prediksiRef.doc(docId);
      
      batch.set(docRef, payload, { merge: true });
    }

    // 3. Commit Semua 18 Pasaran ke Firestore Secara Bersamaan
    await batch.commit();
    console.log(`[BOT] ✅ BERHASIL! 18 Pasaran tanggal ${tanggalWIB} telah diterbitkan ke collection 'prediksi'.`);

  } catch (error) {
    console.error("[BOT] ❌ Terjadi kesalahan saat memproses bot:", error);
    process.exit(1);
  }
}

// Jalankan Bot
runBot();
