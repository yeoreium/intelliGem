// server.js di folder backend
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios'); // Pastikan axios sudah terinstal
const app = express();
const port = process.env.PORT || 3000;
const corsOptions = {
    origin: [
        'http://localhost:3000',
        'https://localhost:3000',
        'http://127.0.0.1:3000',
        'https://127.0.0.1:3000'
      ],
     // perhatikan https!
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  };
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'http://localhost:3000');        // atau '*'
    res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });
  
  

app.use(express.json({ limit: '50mb' }));
// Inisialisasi Google Gemini API
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY tidak ditemukan di file .env!");
    process.exit(1);
}
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // Menggunakan gemini-1.5-flash
const modelpro = genAI.getGenerativeModel({ model: "gemini-2.5-pro" }); // Menggunakan gemini-1.5-flash
console.log(model)

// Inisialisasi Google Custom Search API
const GOOGLE_CSE_API_KEY = process.env.GOOGLE_CSE_API_KEY;
const GOOGLE_CSE_CX_ID = process.env.GOOGLE_CSE_CX_ID;
const Google_Search_URL = 'https://www.googleapis.com/customsearch/v1';

// Middleware
 // Tingkatkan limit body parser untuk gambar Base64

async function callOpenRouter(userPrompt, selectedText, fullDocumentText) {
    // const url = "https://openrouter.ai/api/v1/chat/completions";
    // const headers = {
    //     'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    //     'Content-Type': 'application/json',
    // };
    const AI_SYSTEM_INSTRUCTION = `
    Anda adalah Intelligem, asisten AI cerdas untuk Microsoft Word. Tugas utama Anda adalah menganalisis input pengguna dan mengklasifikasikannya ke dalam SATU kategori kebutuhan data dari daftar di bawah ini.

    ---
    # PETUNJUK PENTING
    1. Baca dengan sangat cermat "Perintah Pengguna", "Teks yang Disorot" (jika ada), dan "Konteks Dokumen" (jika ada).
    2. PILIH HANYA SATU kategori PALING RELEVAN dari daftar berikut. JANGAN PERNAH memilih lebih dari satu.
    3. Output HARUS berupa JSON yang valid, TIDAK mengandung markdown, komentar, spasi ekstra, atau teks lain di luar JSON.
    4. JSON WAJIB hanya memiliki field "category" (dari daftar di bawah).
    5. JANGAN gunakan block markdown dalam respons Anda.
    6. Pastikan JSON dapat diparse tanpa error, tanpa karakter aneh, tanpa newline di luar JSON.
    7. Jika ragu, pilih kategori yang paling aman dan berikan penjelasan singkat di explanation (jika diminta).

    ---
    # DAFTAR KATEGORI KEBUTUHAN DATA
    1. PERLU_SELECTED_TEXT: Permintaan atau pertanyaan yang membutuhkan teks yang sedang disorot di dokumen.
       Contoh: "Parafrase kalimat yang saya sorot." atau "Analisis teks ini." atau "parafrase/ringkas ini"
    2. PERLU_FULL_DOKUMEN: Permintaan membutuhkan seluruh teks dokumen atau JIKA pertanyaan yang BERKAITAN dengan teks dokumen yang bisa anda lihat di bawah.
       Contoh: "Buat ringkasan dari seluruh dokumen ini." atau "Analisis isi dokumen secara keseluruhan."
    3. TANPA_KONTEKS_TEKS_DOKUMEN: Permintaan TIDAK membutuhkan teks dari dokumen (baik sorotan maupun keseluruhan) atau lebih tepatnya tidak berikaitan dengan teks yang disorot atau konteks dokumen.
       Contoh: "Apa itu machine learning?" atau "Jelaskan pengertian AI atau Sapaan dan hal lainnya yang diluar konteks dokumen"
    4. PERLU_KEDUANYA: Permintaan membutuhkan teks (baik yang disorot maupun keseluruhan dokumen) sebagai parameter utama.
       Contoh: "Analisis hubungan antara bagian ini dengan isi dokumen." atau "apakah teks berikut sudah cocok dengan laporan saya?"

    ---
    # FORMAT OUTPUT WAJIB
    {"category": "NAMA_KATEGORI_YANG_DIPILIH"}

    ---
    # CONTOH OUTPUT YANG BENAR
    {"category": "PERLU_SELECTED_TEXT"}
    {"category": "TANPA_KONTEKS_TEKS_DOKUMEN"}

    

    ---
    # CATATAN
    - JANGAN PERNAH menambahkan teks di luar JSON.
    - Pastikan respons Anda mudah dipahami dan langsung ke inti.
    
    ## KONTEKS INPUT
    Perintah pengguna: "${userPrompt}"
    ${selectedText ? `Teks yang disorot: "${selectedText}"` : '### Tidak Ada Input ###'}
    ${fullDocumentText ? `Konteks dokumen (awal): "${fullDocumentText.substring(0, 1000)}..."` : '### Dokumen Kosong ###'}

    **SEKARANG ANALISIS KONTEKS DI ATAS DAN BERIKAN RESPONS JSON YANG SESUAI:**
    `;

    // const body = {
    //     model: "moonshotai/kimi-dev-72b:free",
    //     messages: [
    //         { role: "system", content: AI_SYSTEM_INSTRUCTION },
    //         { role: "user", content: userPrompt }
    //     ]
    // };

    // const response = await axios.post(url, body, { headers });
    const result = await model.generateContent(AI_SYSTEM_INSTRUCTION);
    const response = await result.response;
    
    console.log(response.text())
    return response.text();
}


// --- Endpoint API Intelligem ---
app.post('/api/intelligem', async (req, res) => {
    const { userPrompt, selectedText, fullDocumentText, imageData, aiSelection } = req.body;
    console.log(`
        ########################################
        "${aiSelection}"
        ########################################
        `)
        // --- Logika untuk FIND_SOURCE ---
        if (aiSelection === 'findsource') {
            if (selectedText) {
                if (!GOOGLE_CSE_API_KEY || !GOOGLE_CSE_CX_ID) {
                    throw new Error("Kunci API atau CX ID Google Custom Search belum dikonfigurasi di .env!");
                }
                const queryForSource = selectedText || userPrompt; // Cari sumber dari teks sorot atau prompt
                const searchResults = await searchGoogle(queryForSource);
                let sourceString = ""
                if (searchResults && searchResults.length > 0) {
                    searchResults.forEach((item, index) => {
                        sourceString += `${index + 1}. [${item.title}](${item.link})\n`;
                        if (item.snippet) sourceString += `   Snippet: ${item.snippet.substring(0, Math.min(item.snippet.length, 200))}...\n\n`; // Batasi snippet
                    });
                } else {
                    sourceString += "Tidak ada sumber yang ditemukan untuk teks ini.";
                }
                return res.json({ 
                    perlu_actionable: false,
                    explanation: sourceString, 
                    actionable_text: undefined 
                });
            } 
            // Kirim respons FIND_SOURCE kembali ke frontend
            
        }
        else{
            // Prompt dasar untuk Gemini untuk menentukan intent dan menghasilkan JSON
            let geminiPrompt = "";
            let contextParts = [];
        
            // Tambahkan prompt pengguna
            contextParts.push({ text: `Perintah pengguna: "${userPrompt}"` });
        
            // Tambahkan teks yang disorot sebagai konteks
            if (selectedText) {
                contextParts.push({ text: `Teks yang disorot: "${selectedText}"` });
            }
            
            // Tambahkan seluruh dokumen sebagai konteks tambahan, batasi agar tidak terlalu panjang
            if (fullDocumentText && fullDocumentText.length > 500) { // Hanya tambahkan jika signifikan
                contextParts.push({ text: `Konteks dokumen penuh (awal): "${fullDocumentText.substring(0, 1000)}..."` });
            } else if (fullDocumentText) {
                contextParts.push({ text: `Konteks dokumen penuh: "${fullDocumentText}"` });
            }
            // --- CALL ke OpenRouter DeepSeek ---
            const openrouterResponse = await callOpenRouter(userPrompt, selectedText, fullDocumentText);
        
            // Ambil isi text (DeepSeek kirim di choices[0].message.content)
            // const textResponse = openrouterResponse.choices[0].message.content
            // console.log("++++++++++++\n",textResponse,"\n++++++++++++")
            // Bersihkan block markdown jika ada
            const cleanedText = openrouterResponse.replace(/```json|```/g, '').trim();
            let parsed = JSON.parse(cleanedText);
            console.log("++++++++++++\n",parsed,"\n++++++++++++")
        
            // Tambahkan gambar jika ada
            if (imageData) {
                contextParts.push({
                    inlineData: {
                        data: imageData,
                        mimeType: 'image/jpeg', // Asumsi JPEG, di produksi perlu deteksi mime type akurat
                    },
                });
            }
        
            // --- PROMPT ENGINEERING UNTUK KLASIFIKASI KEBUTUHAN ACTIONABLE ---
        
            
            
            const no_contextPrompt = `Anda adalah Intelligem, asisten AI cerdas yang dirancang khusus untuk membantu pengguna dalam mengelola, menganalisis, dan memproses dokumen. Anda memiliki kemampuan untuk memahami konteks, menganalisis gambar, dan memberikan respons yang akurat dan bermanfaat.
        # PETUNJUK PENTING
        1. Baca "Perintah Pengguna" dengan cermat.
        2. Output HARUS berupa JSON yang valid, TIDAK mengandung markdown, komentar, spasi ekstra, atau teks lain di luar JSON.
        3. explanation WAJIB informatif, ringkas, dan mudah dipahami.
        ## INSTRUKSI UTAMA
        - ANALISIS konteks dan tentukan apakah permintaan membutuhkan actionable_text.
        - Jika actionable_text diperlukan, hasilkan teks yang benar-benar siap pakai, relevan, dan berkualitas.
        - Jika tidak, explanation harus tetap informatif dan actionable_text null.
        
        # Format RESPONSE JSON yang menjadi JAWABAN anda (TANPA mengandung markdown, komentar, atau teks lain di luar JSON)
        {
            "perlu_actionable": true or false,
            "explanation": "Jawaban kamu mengenai Perintah Pengguna, harus jelas dan informatif.",
            "actionable_text": "actionable text jika di perlukan"
        }
        
        `;
            geminiPrompt = `
        ## PERAN DAN TUJUAN
        Anda adalah Intelligem, asisten AI cerdas untuk Microsoft Word. Anda membantu pengguna mengelola, menganalisis, dan memproses dokumen dengan memberikan jawaban (explanation) dan, jika perlu, teks siap pakai (actionable_text).
        ---
        # PETUNJUK PENTING
        1. Baca "Perintah Pengguna", "Teks yang Disorot" (jika ada), dan "Konteks Dokumen" (jika ada) dengan sangat cermat.
        2. Output HARUS berupa JSON yang valid, TIDAK mengandung markdown, komentar, spasi ekstra, atau teks lain di luar JSON.
        3. JSON WAJIB hanya memiliki field: perlu_actionable (true/false), explanation, actionable_text (null jika tidak perlu).
        4. explanation WAJIB berisi penjelasan, analisis, atau jawaban utama yang informatif, bernilai, dan mudah dipahami, selalu ingat peran anda sebagai intelliGem, berikan explanation yang langsung terarah ke pengguna.
        5. actionable_text HANYA diisi jika permintaan pengguna memang membutuhkan hasil teks siap pakai (parafrase, ringkasan, generasi teks, dsb). Jika tidak, WAJIB null.
        6. actionable_text TIDAK BOLEH berisi penjelasan, hanya teks hasil akhir yang siap copy-paste.
        7. JANGAN gunakan block markdown  dalam respons Anda.
        8. Pastikan JSON dapat diparse tanpa error, tanpa karakter aneh, tanpa newline di luar JSON.
        
        ## INSTRUKSI UTAMA
        - ANALISIS konteks dan tentukan apakah permintaan membutuhkan actionable_text.
        - Jika actionable_text diperlukan, hasilkan teks yang benar-benar siap pakai, relevan, dan berkualitas.
        - Jika tidak, explanation harus tetap informatif dan actionable_text null.
        
        ## DO & DON'T
        - DO: explanation harus jelas dan merupakan jawaban anda kepada pengguna langsung (lakukan interaksi langsung ke pengguna sebagai chat bot), actionable_text hanya jika perlu.
        - DON'T: Jangan pernah gabungkan explanation dan actionable_text, serta pada explanation jangan berikan jawaban yang tidak berkaitan dengan perintah pengguna.
        - DO: Gunakan bahasa Indonesia yang formal, sopan, dan mudah dipahami.
        - DON'T: Jangan pernah tambahkan karakter di luar JSON.
        
        ## CONTOH OUTPUT YANG BENAR
        {"perlu_actionable": true, "explanation": "Saya telah memparafrase kalimat berikut...", "actionable_text": "Teks hasil parafrase..."}
        {"perlu_actionable": false, "explanation": "Machine learning adalah...", "actionable_text": null}
        
        
        
        ## TROUBLESHOOTING
        - Jika ragu, explanation harus menjelaskan alasan keputusan Anda, dan berikan analisis kemungkinan maksud dari pengguna sebenarnya seperti "mungkin maksud anda ...".
        - Selalu cek kembali format JSON sebelum mengirim.
        
        ## KONTEKS INPUT
        Perintah pengguna: "${userPrompt}"
        ${selectedText ? `Teks yang disorot: "${selectedText}"` : ''}
        ${imageData ? `Ada gambar sebagai input untuk dianalisis.` : ''}
        ${fullDocumentText ? `Konteks dokumen (awal): "${fullDocumentText.substring(0, 1000)}..."` : ''}
        
        **SEKARANG ANALISIS KONTEKS DI ATAS DAN BERIKAN RESPONS JSON YANG SESUAI:**
            `;
            try {
                console.log(userPrompt)
                
                let kebutuhan = "";
                if (parsed.category == "PERLU_FULL_DOKUMEN") {
                    kebutuhan = `Perintah pengguna: "${userPrompt}"
                        ${fullDocumentText ? `Konteks dokumen (awal): "${fullDocumentText}..."` : ''}
                    `
                }
                else if (parsed.category == "PERLU_SELECTED_TEXT") {
                    kebutuhan = `Perintah pengguna: "${userPrompt}" ${selectedText ? `Teks yang disorot: "${selectedText}"` : ''}`
                }
                else if (parsed.category == "PERLU_KEDUANYA") {
                    kebutuhan = `Perintah pengguna: "${userPrompt}"
                        ${selectedText ? `Teks yang disorot: "${selectedText}"` : ''}
                        ${imageData ? `Ada gambar sebagai input untuk dianalisis.` : ''}
                        ${fullDocumentText ? `Konteks dokumen (awal): "${fullDocumentText.substring(0, 1000)}..."` : ''}`
                }
                else {
                    kebutuhan = `Perintah pengguna: "${userPrompt}"`
                }
        
                
                    const fullGeminiParts = []; 
                    if (parsed.category == "TANPA_KONTEKS_TEKS_DOKUMEN") {
                        fullGeminiParts.push(
                            { text: no_contextPrompt },
                            { text: kebutuhan }
                          );
                    }
                    else{
                        fullGeminiParts.push(
                            { text: geminiPrompt },
                            { text: kebutuhan }
                          );
                    }
                    
                    const result = await model.generateContent(fullGeminiParts);
                    const responseFromGemini = await result.response;
                    let geminiTextResponse = responseFromGemini.text();
                    console.log("Raw Gemini Response (before cleanup):", geminiTextResponse, "Gemini Model:", model.model); // Log respons mentah sebelum dibersihkan
        
                    // --- SOLUSI FIX: Bersihkan respons dari Markdown JSON block ---
                    const cleaned = responseFromGemini.text().replace(/```json|```/g, '').trim();
                    const parsedGeminiResponse = JSON.parse(cleaned);
                    // --- END SOLUSI FIX ---
        
                    console.log("Cleaned Gemini Response:", parsedGeminiResponse);
                    res.json(parsedGeminiResponse);
                
        
            }
            catch {
                console.error('Error in /api/intelligem:', error);
                res.status(500).json({ error: error.message || 'Gagal memproses permintaan dengan Intelligem. Periksa log server.' });
            }

        }
    
    



    // try {
    //     // Gabungkan prompt utama dengan konteks tambahan
    //     const fullGeminiParts = [{ text: geminiPrompt }, ...contextParts.slice(1)];

    //     const result = await model.generateContent(fullGeminiParts);
    //     const responseFromGemini = await result.response;
    //     let geminiTextResponse = responseFromGemini.text();
    //     console.log("Raw Gemini Response (before cleanup):", geminiTextResponse, "Gemini Model:", model.model); // Log respons mentah sebelum dibersihkan

    //     // --- SOLUSI FIX: Bersihkan respons dari Markdown JSON block ---
    //     const cleaned = responseFromGemini.text().replace(/```json|```/g, '').trim();
    //     const parsedGeminiResponse = JSON.parse(cleaned);
    //     // --- END SOLUSI FIX ---

    //     console.log("Cleaned Gemini Response:", parsedGeminiResponse); // Log respons setelah dibersihkan

    //     // --- Logika untuk FIND_SOURCE ---
    //     if (parsedGeminiResponse.type === 'FIND_SOURCE') {
    //         if (!GOOGLE_CSE_API_KEY || !GOOGLE_CSE_CX_ID) {
    //             throw new Error("Kunci API atau CX ID Google Custom Search belum dikonfigurasi di .env!");
    //         }
    //         const queryForSource = selectedText || userPrompt; // Cari sumber dari teks sorot atau prompt
    //         const searchResults = await searchGoogle(queryForSource);
    //         let sourceString = parsedGeminiResponse.explanation + "\n\n"; // Mulai dengan penjelasan Gemini
    //         if (searchResults && searchResults.length > 0) {
    //             searchResults.forEach((item, index) => {
    //                 sourceString += `${index + 1}. [${item.title}](${item.link})\n`;
    //                 if (item.snippet) sourceString += `   Snippet: ${item.snippet.substring(0, Math.min(item.snippet.length, 200))}...\n\n`; // Batasi snippet
    //             });
    //         } else {
    //             sourceString += "Tidak ada sumber yang ditemukan untuk teks ini.";
    //         }
    //         // Kirim respons FIND_SOURCE kembali ke frontend
    //         return res.json({ 
    //             explanation: sourceString, 
    //             type: 'FIND_SOURCE',
    //             actionable_text: undefined 
    //         });
    //     }
        
    //     // Mengirim respons JSON yang sudah diparse dari Gemini ke frontend
    //     res.json(parsedGeminiResponse);

    // } catch (error) {
    //     console.error('Error in /api/intelligem:', error);
    //     res.status(500).json({ error: error.message || 'Gagal memproses permintaan dengan Intelligem. Periksa log server.' });
    // }
});

// --- Fungsi untuk memanggil Google Custom Search API ---
async function searchGoogle(query) {
    try {
        const response = await axios.get(Google_Search_URL, {
            params: {
                key: GOOGLE_CSE_API_KEY,
                cx: GOOGLE_CSE_CX_ID,
                q: query,
                num: 3 // Ambil 3 hasil teratas
            }
        });
        return response.data.items || [];
    } catch (error) {
        console.error('Error calling Google Custom Search API:', error.response ? error.response.data : error.message);
        throw new Error('Gagal mencari sumber. Periksa kunci API/CX ID CSE atau batas kuota.');
    }
}

// --- Menjalankan Server ---
app.listen(port, () => {
    console.log(`Backend server running on http://localhost:${port}`);
    console.log(`Intelligem API endpoint: http://localhost:${port}/api/intelligem`);
});