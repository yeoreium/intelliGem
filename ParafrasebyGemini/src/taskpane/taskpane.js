// taskpane.js

const { marked } = require("marked");

/* global document, Office, Word, btoa, marked */ // Tambahkan 'marked' di sini

// URL ke backend Node.js kamu
const BACKEND_URL = "intelligem-production-10d1.up.railway.app/api/intelligem";

// State management untuk halaman
let currentPage = 'welcome-page';

Office.onReady((info) => {
    if (info.host === Office.HostType.Word) {
        console.log("Office.js is ready. Host type:", info.host);

        const sideloadMsg = document.getElementById("sideload-msg");
        if (sideloadMsg) {
            sideloadMsg.style.display = "none";
        }
        
        // Tampilkan welcome page sebagai halaman pertama
        showPage('welcome-page');

        // Event listeners untuk navigasi
        document.getElementById("startButton").onclick = () => navigateToPage('main-page');
        document.getElementById("settingsButton").onclick = () => navigateToPage('settings-page');
        document.getElementById("backToMainButton").onclick = () => navigateToPage('main-page');

        // Event listeners untuk chatbot
        document.getElementById("sendPromptButton").onclick = sendPrompt;

        document.getElementById("textPromptInput").addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendPrompt();
            }
        });

        console.log("UI terhubung.");
    } else {
        console.log("Add-in tidak berjalan di Word.");
    }
});

/**
 * Fungsi untuk navigasi antar halaman dengan animasi
 * @param {string} pageId ID halaman yang akan ditampilkan
 */
function navigateToPage(pageId) {
    if (currentPage === pageId) return; // Jangan navigasi ke halaman yang sama
    
    const currentPageElement = document.getElementById(currentPage);
    if (currentPageElement) {
        currentPageElement.classList.add('fade-out');
        
        setTimeout(() => {
            showPage(pageId);
            currentPage = pageId;
        }, 200);
    } else {
        showPage(pageId);
        currentPage = pageId;
    }
}

/**
 * Fungsi untuk menampilkan halaman tertentu dan menyembunyikan halaman lainnya
 * @param {string} pageId ID halaman yang akan ditampilkan
 */
function showPage(pageId) {
    // Sembunyikan semua halaman
    const pages = ['welcome-page', 'main-page', 'settings-page','footer','header'];
    const footer = document.getElementById(pages[3]);
    const header = document.getElementById(pages[4])
    pages.forEach(page => {
        const pageElement = document.getElementById(page);
        if (pageElement) {
            pageElement.style.display = 'none';
            pageElement.classList.remove('fade-in', 'fade-out');
        }
    });
    
    // Tampilkan halaman yang dipilih
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.style.display = 'flex';
        targetPage.classList.add('fade-in');
        // Jika menampilkan main page, fokus ke input
        if (pageId === 'main-page') {
            footer.style.display = 'flex';
            header.style.display = 'flex';
            setTimeout(() => {
                const textInput = document.getElementById("textPromptInput");
                if (textInput) {
                    textInput.focus();
                }
            }, 300);
        }
    }
    console.log(`Navigated to: ${pageId}`);
}

/**
 * Mengirim prompt teks ke backend, selalu dengan konteks seleksi teks/gambar.
 */
async function sendPrompt() {
    document.getElementById("chat-interface").style.opacity = 100;
    const textPromptInput = document.getElementById("textPromptInput");
    const userPrompt = textPromptInput.value.trim();
    const aiSelection = document.getElementById("ai-selector").value
    
    
    clearMessages();
    disableButtons(true);

    if (!userPrompt) {
        showError("Mohon masukkan perintah atau pertanyaan Anda.");
        disableButtons(false);
        return;
    }

    addMessageToChat('user', userPrompt);
    textPromptInput.value = '';
    
    // Tampilkan typing indicator
    showTypingIndicator();

    try {
        await Word.run(async (context) => {
            const selection = context.document.getSelection();
            selection.load("text");
            selection.load("inlinePictures"); 

            await context.sync();

            const selectedText = selection.text.trim();
            let selectedImageBase64 = null;

            if (selection.inlinePictures.items.length > 0) {
                const picture = selection.inlinePictures.items[0];
                picture.load("getBase64ImageSrc");
                await context.sync();
                selectedImageBase64 = picture.getBase64ImageSrc; 
                if (selectedImageBase64) {
                    const parts = selectedImageBase64.split(',');
                    if (parts.length > 1) {
                        selectedImageBase64 = parts[1];
                    } else {
                        selectedImageBase64 = null;
                    }
                }
            }

            const body = context.document.body;
            body.load("text");
            await context.sync();
            const fullDocumentText = body.text.trim();

            await callIntelligemAPI(userPrompt, selectedText, selectedImageBase64, fullDocumentText, aiSelection);

        });
    } catch (error) {
        console.error("Kesalahan saat mengirim prompt ke Intelligem:", error);
        showError(`Terjadi kesalahan: ${error.message}. Periksa console.`);
    } finally {
        hideTypingIndicator();
        disableButtons(false);
    }
}

/**
 * Fungsi inti untuk memanggil API backend Intelligem.
 * @param {string} userPrompt Prompt teks dari pengguna.
 * @param {string} aiSelection
 * @param {string} selectedText Teks yang disorot di dokumen.
 * @param {string | null} selectedImageBase64 Data gambar Base64 dari dokumen.
 * @param {string} fullDocumentText Seluruh teks dokumen sebagai konteks.
 */
async function callIntelligemAPI(userPrompt, selectedText, selectedImageBase64, fullDocumentText, aiSelection) {
    showStatus("Intelligem sedang memproses... Harap tunggu.");
    try {
        const payload = {
            userPrompt: userPrompt,
            selectedText: selectedText,
            fullDocumentText: fullDocumentText,
            aiSelection: aiSelection
        };

        // if (selectedImageBase64) {
        //     payload.imageData = selectedImageBase64;
        // }

        const response = await fetch(BACKEND_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        console.log("Response status dari backend Intelligem:", response.status);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`HTTP error! Status: ${response.status} - ${errorData.error || response.statusText || 'Unknown error from backend'}`);
        }

        const data = await response.json();
        console.log("Data diterima dari backend Intelligem:", data);

        // Sembunyikan typing indicator sebelum menampilkan respons
        hideTypingIndicator();

        if (data.explanation) {
            addMessageToChat('ai', data.explanation, data.perlu_actionable, selectedText, data.actionable_text);
        } else {
            showError("Gagal mendapatkan respons AI yang valid dari Intelligem.");
            addMessageToChat('ai', "Intelligem: Maaf, saya tidak bisa memproses permintaan Anda.");
        }

        showStatus("Respons Intelligem diterima.");

    } catch (error) {
        console.error("Kesalahan saat memanggil Intelligem API:", error);
        hideTypingIndicator();
        showError(`Terjadi kesalahan: ${error.message}.`);
        addMessageToChat('ai', `Intelligem: Terjadi kesalahan. ${error.message}`);
    }
}

/**
 * Menyisipkan hasil AI ke dokumen Word.
 * @param {string} mode 'replace' atau 'insert'.
 * @param {string} textToInsert Teks yang akan disisipkan/diganti.
 */
async function insertAIResponse(mode, textToInsert) {
    try {
        await Word.run(async (context) => {
            const range = context.document.getSelection();
            if (mode === 'replace') {
                range.insertHtml(textToInsert, Word.InsertLocation.replace);
            } else if (mode === 'insert') {
                range.insertText(textToInsert, Word.InsertLocation.after);
            }
            await context.sync();
            showStatus("Teks berhasil disisipkan/diganti!");
        });
    } catch (error) {
        console.error("Gagal menyisipkan/mengganti teks:", error);
        showError(`Gagal menyisipkan/mengganti: ${error.message}`);
    }
}


/**
 * Menambahkan pesan ke riwayat chat.
 * @param {string} sender 'user' atau 'ai'
 * @param {string} explanation Teks penjelasan dari AI.
 * @param {string} [perlu_actionable] (Opsional) Tipe respons dari AI (paraphrase, summarize, etc.) - dari JSON AI
 * @param {string} [originalContextText] (Opsional) Teks asli/konteks dari Word - dari JS frontend
 * @param {string} [actionableText] (Opsional) Teks yang bisa di-action (paraphrased/generated text) - dari JSON AI
 */
function addMessageToChat(sender, explanation, perluActionable = null, originalContextText = null, actionableText = null) {
    const chatHistory = document.getElementById("chatHistory");
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("chat-message", `${sender}-message`);
    
    if (sender === 'ai') {
        // Tambahkan header untuk pesan AI
        const messageHeader = document.createElement('div');
        messageHeader.classList.add('message-header');
        
        const aiName = document.createElement('img');
        aiName.src = "assets/intelliGem.png";
        aiName.classList.add('logo-message');
        messageHeader.appendChild(aiName);
        messageDiv.appendChild(messageHeader);

        const explanationContent = document.createElement('p');
        // Gunakan innerHTML untuk menampilkan format markdown dasar (seperti bold, italic, list)
        explanationContent.innerHTML = marked.parse(explanation); // Ini menampilkan explanation

        messageDiv.appendChild(explanationContent);

        // --- Bagian BARU: Menampilkan actionable_text dalam box terpisah ---
        if (actionableText) {
            const actionableTextBox = document.createElement('div');
            actionableTextBox.classList.add('ai-actionable-text-box'); // Class CSS baru
            const actionable_text_html = marked.parse(actionableText)
            actionableTextBox.innerHTML = marked.parse(actionableText); // Tampilkan actionable_text di sini
            messageDiv.appendChild(actionableTextBox);

            // Tambahkan tombol aksi di bawah actionable_text box
            const actionsDiv = document.createElement('div');
            actionsDiv.classList.add('ai-actions');

            const replaceBtn = document.createElement('button');
            replaceBtn.classList.add('ai-action-button');
            replaceBtn.innerHTML = '<i class="fas fa-exchange-alt"></i> Ganti Teks Asli';
            replaceBtn.onclick = () => insertAIResponse('replace', actionable_text_html);
            actionsDiv.appendChild(replaceBtn);

            const insertBtn = document.createElement('button');
            insertBtn.classList.add('ai-action-button');
            insertBtn.innerHTML = '<i class="fas fa-plus"></i> Sisipkan Baru';  
            insertBtn.onclick = () => insertAIResponse('insert', actionableText);
            actionsDiv.appendChild(insertBtn);

            messageDiv.appendChild(actionsDiv);
            messageDiv.dataset.actionableText = actionableText; // Simpan untuk referensi

            if (originalContextText) {
                messageDiv.dataset.originalContextText = originalContextText;
            }
        }
        
        // Tombol "Cari Sumber" (jika ada originalContextText dan respons type relevan, dan belum ada actionsDiv)
        // Jika ada actionableText, tombol source akan digabung di actionsDiv yang sama.
        // if (originalContextText && (responseType === 'paraphrase' || responseType === 'summarize' || responseType === 'general_text' || responseType === 'image_description')) {
        //      let actionsDiv = messageDiv.querySelector('.ai-actions'); // Coba ambil actionsDiv yang sudah ada
        //      if (!actionsDiv) { // Jika belum ada (misal tidak ada actionable_text), buat yang baru
        //          actionsDiv = document.createElement('div');
        //          actionsDiv.classList.add('ai-actions');
        //          messageDiv.appendChild(actionsDiv);
        //      }

        //      const findSourceBtn = document.createElement('button');
        //      findSourceBtn.classList.add('ai-action-button');
        //      findSourceBtn.innerHTML = '<i class="fas fa-search"></i> Cari Sumber Teks Ini';
        //      findSourceBtn.onclick = () => addMessageToChat('user', `Cari sumber untuk: "${originalContextText.substring(0, Math.min(originalContextText.length, 50))}..."`)
        //                                  .then(() => sendPromptFromSpecificContext(`Cari sumber untuk teks ini: "${originalContextText}"`));
             
        //      actionsDiv.appendChild(findSourceBtn);
        // }

    } else { // Pesan User
        messageDiv.innerText = explanation; // Untuk user, 'message' adalah promptnya
    }
    
    chatHistory.appendChild(messageDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    textPromptInput.focus();
}

/**
 * Fungsi ini digunakan untuk memanggil sendPrompt dari dalam addMessageToChat (misal dari tombol Cari Sumber)
 * agar bisa mengirimkan prompt yang sudah diformat dengan konteks yang diinginkan.
 */
async function sendPromptFromSpecificContext(prompt) {
    const textPromptInput = document.getElementById("textPromptInput");
    textPromptInput.value = prompt; // Set prompt ke input
    await sendPrompt(); // Kirim prompt
}

/**
 * Fungsi untuk mengontrol disable/enable tombol.
 */
function disableButtons(status) {
    document.getElementById("sendPromptButton").disabled = status;
    document.getElementById("textPromptInput").disabled = status;
}

/**
 * Fungsi untuk menampilkan pesan status.
 * @param {string} message Pesan yang akan ditampilkan.
 */
function showStatus(message) {
    const statusDiv = document.getElementById("statusMessage");
    const errorDiv = document.getElementById("errorMessage");
    const statusText = statusDiv.querySelector(".status-text");
    statusText.innerText = message;
    statusDiv.style.display = "flex";
    errorDiv.style.display = "none";
}

/**
 * Fungsi untuk menampilkan pesan error.
 * @param {string} message Pesan error yang akan ditampilkan.
 */
function showError(message) {
    const statusDiv = document.getElementById("statusMessage");
    const errorDiv = document.getElementById("errorMessage");
    const errorText = errorDiv.querySelector(".error-text");
    errorText.innerText = message;
    errorDiv.style.display = "flex";
    statusDiv.style.display = "none";
}

/**
 * Fungsi untuk membersihkan semua pesan status/error.
 */
function clearMessages() {
    document.getElementById("statusMessage").style.display = "none";
    document.getElementById("errorMessage").style.display = "none";
    document.getElementById("statusMessage").querySelector(".status-text").innerText = "";
    document.getElementById("errorMessage").querySelector(".error-text").innerText = "";
}

/**
 * Menampilkan typing indicator saat AI sedang memproses.
 */
function showTypingIndicator() {
    const chatHistory = document.getElementById("chatHistory");
    
    // Hapus typing indicator yang sudah ada
    const existingIndicator = chatHistory.querySelector('.typing-indicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }
    
    const typingDiv = document.createElement("div");
    typingDiv.classList.add("ai-message", "chat-message", "typing-indicator");
    typingDiv.style.maxWidth = "80px";
    
    const messageHeader = document.createElement('div');
    messageHeader.classList.add('message-header');
    
    // const aiIcon = document.createElement('i');
    // aiIcon.classList.add('fas', 'fa-robot', 'ai-icon');
    
    
    
    // messageHeader.appendChild(aiIcon);
    typingDiv.appendChild(messageHeader);
    
    const dotsContainer = document.createElement('div');
    dotsContainer.style.display = 'flex';
    dotsContainer.style.gap = '4px';
    dotsContainer.style.marginTop = '8px';
    
    for (let i = 0; i < 3; i++) {
        const dot = document.createElement('div');
        dot.classList.add('typing-dot');
        dotsContainer.appendChild(dot);
    }
    
    typingDiv.appendChild(dotsContainer);
    chatHistory.appendChild(typingDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

/**
 * Menyembunyikan typing indicator.
 */
function hideTypingIndicator() {
    const typingIndicator = document.querySelector('.typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}