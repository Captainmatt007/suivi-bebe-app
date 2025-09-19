// --- CONFIGURATION FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyAYADf-SF33-aB9YewWjAyJtWAsuSvmPgA",
  authDomain: "suivi-bebe-f65dd.firebaseapp.com",
  projectId: "suivi-bebe-f65dd",
  storageBucket: "suivi-bebe-f65dd.appspot.com",
  messagingSenderId: "684104749476",
  appId: "1:684104749476:web:f6a9dc3b0911725bbd3131",
};

// --- INITIALISATION ---
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
let currentUser = null; 
let growthChartInstance = null;
let originalMainHTML = '';

// --- FONCTIONS DE CONNEXION ---
function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(error => {
    console.error("Erreur de connexion:", error);
    showMessage(`Erreur: ${error.code}`, 'error');
  });
}
function signOut() {
    auth.signOut().catch(error => console.error("Erreur de déconnexion:", error));
}

// --- FONCTIONS DE RENDU UI ---
function displayLoginScreen(mainElement) {
    mainElement.innerHTML = `
      <div id="login-screen">
        <section class="login-container">
          <div class="login-card">
            <img src="image/login-illustration.png" alt="Illustration d'un bébé">
            <h2>Bienvenue sur Suivi Bébé</h2>
            <p>Connectez-vous pour commencer.</p>
            <button onclick="signInWithGoogle()" class="bouton-principal google-login-button">
              <svg viewBox="0 0 48 48"><path fill="#fbc02d" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"></path><path fill="#e53935" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"></path><path fill="#4caf50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"></path><path fill="#1565c0" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.19 4.12-4.008 5.574l6.19 5.238C42.018 35.272 44 30.022 44 24c0-1.341-.138-2.65-.389-3.917z"></path></svg>
              <span>Se connecter avec Google</span>
            </button>
          </div>
        </section>
      </div>`;
}

function displayAppShell(mainElement) {
    if(!document.getElementById('accueil')) {
        mainElement.innerHTML = originalMainHTML;
        setupEventListeners(); 
    }
}

// --- FONCTIONS DE DONNÉES (FIRESTORE) ---
async function envoyerDonnees(donnees) {
  if (!currentUser) return showMessage("Vous devez être connecté pour enregistrer.", 'error');
  const dataToSave = { ...donnees, userId: currentUser.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp() };
  try {
    await db.collection("events").add(dataToSave);
    showMessage('✅ Données enregistrées !');
    if (donnees.type !== 'sommeil') {
      history.back();
    } else {
      await updateSleepInfo();
    }
  } catch (error) {
    console.error("Erreur d'écriture Firestore:", error);
    showMessage("Erreur d'enregistrement.", 'error');
  }
}

async function loadInitialData() {
    if (!currentUser) return;
    const bebeNomDisplay = document.getElementById('bebe-nom');
    const bebeAgeDisplay = document.getElementById('bebe-age');
    const inputBebeNom = document.getElementById('input-bebe-nom');
    const inputBebeDob = document.getElementById('input-bebe-dob');
    const bebePoidsDisplay = document.getElementById('bebe-poids');
    const bebeTailleDisplay = document.getElementById('bebe-taille');

    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    if (userDoc.exists) {
        const userData = userDoc.data();
        bebeNomDisplay.textContent = userData.prenom || "Mon Bébé";
        inputBebeNom.value = userData.prenom || "";
        bebeAgeDisplay.textContent = calculateAge(userData.naissance) || "-";
        inputBebeDob.value = userData.naissance || "";
    } else {
        bebeNomDisplay.textContent = "Mon Bébé";
        inputBebeNom.value = "";
        bebeAgeDisplay.textContent = "-";
        inputBebeDob.value = "";
    }

    const querySnapshot = await db.collection("events")
        .where("userId", "==", currentUser.uid).where("type", "==", "sante")
        .orderBy("createdAt", "desc").limit(1).get();
        
    bebePoidsDisplay.textContent = '- kg';
    bebeTailleDisplay.textContent = '- cm';
    if (!querySnapshot.empty) {
        const data = querySnapshot.docs[0].data();
        if (data.poids) bebePoidsDisplay.textContent = `${data.poids} kg`;
        if (data.taille) bebeTailleDisplay.textContent = `${data.taille} cm`;
    }
}

async function updateSleepInfo() {
    if (!currentUser) return;
    const sleepInfoDiv = document.getElementById('ongoing-sleep-info');
    const sleepStartTimeSpan = document.getElementById('sleep-start-time');
    const startSleepBtn = document.getElementById('start-sleep-btn');
    
    const querySnapshot = await db.collection("events")
        .where("userId", "==", currentUser.uid).where("type", "==", "sommeil")
        .orderBy("createdAt", "desc").limit(1).get();

    let ongoing = false;
    if (!querySnapshot.empty) {
        const lastSleep = querySnapshot.docs[0].data();
        if (lastSleep.heureDebut && !lastSleep.heureFin) {
            ongoing = true;
            if (lastSleep.createdAt) {
                const startTime = lastSleep.createdAt.toDate();
                sleepStartTimeSpan.textContent = startTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            }
        }
    }
    sleepInfoDiv.classList.toggle('hidden', !ongoing);
    startSleepBtn.disabled = ongoing;
    startSleepBtn.textContent = ongoing ? "Sommeil déjà en cours..." : "Début du sommeil";
}

async function fetchGrowthData() {
    if (!currentUser) return null;
    const querySnapshot = await db.collection("events").where("userId", "==", currentUser.uid)
        .where("type", "==", "sante").orderBy("createdAt", "asc").get();
    const labels = [], weights = [], heights = [];
    querySnapshot.forEach(doc => {
        const data = doc.data();
        if (data.poids || data.taille) {
            const date = data.createdAt.toDate().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
            labels.push(date);
            weights.push(data.poids || null);
            heights.push(data.taille || null);
        }
    });
    return { labels, weights, heights };
}

function renderGrowthChart(chartData) {
    const ctx = document.getElementById('growthChart')?.getContext('2d');
    if (!ctx) return;
    if (growthChartInstance) { growthChartInstance.destroy(); }
    growthChartInstance = new Chart(ctx, {
        type: 'line', data: { labels: chartData.labels,
            datasets: [{
                label: 'Poids (kg)', data: chartData.weights, borderColor: 'rgba(126, 120, 210, 1)',
                backgroundColor: 'rgba(126, 120, 210, 0.2)', fill: false, yAxisID: 'y-poids',
            }, {
                label: 'Taille (cm)', data: chartData.heights, borderColor: 'rgba(255, 159, 64, 1)',
                backgroundColor: 'rgba(255, 159, 64, 0.2)', fill: false, yAxisID: 'y-taille',
            }]
        },
        options: { responsive: true, scales: { yAxes: [{
                    id: 'y-poids', type: 'linear', position: 'left', ticks: { beginAtZero: false },
                    scaleLabel: { display: true, labelString: 'Poids (kg)' }
                }, {
                    id: 'y-taille', type: 'linear', position: 'right', ticks: { beginAtZero: false },
                    scaleLabel: { display: true, labelString: 'Taille (cm)' },
                    gridLines: { drawOnChartArea: false },
                }]
            }
        }
    });
}

// --- LOGIQUE UI ET POINT D'ENTRÉE ---
function setupEventListeners() {
    const body = document.body;
    const themeToggleButton = document.getElementById('theme-toggle-button');
    const accueilSection = document.getElementById('accueil');
    const sectionsWrapper = document.getElementById('sections-wrapper');
    const allSections = sectionsWrapper.querySelectorAll('section');
    const categoryButtons = document.querySelectorAll('.category-button');
    const returnButtons = document.querySelectorAll('.bouton-retour');
  
    const setTheme = (theme) => {
        body.classList.toggle('dark-mode', theme === 'dark');
        themeToggleButton.textContent = theme === 'dark' ? '☀️' : '🌙';
        localStorage.setItem('theme', theme);
    };
    if (themeToggleButton) themeToggleButton.addEventListener('click', () => setTheme(body.classList.contains('dark-mode') ? 'light' : 'dark'));
    setTheme(localStorage.getItem('theme') || 'light');

    async function showSection(sectionId, fromHistory = false) {
        if (!currentUser) return showMessage("Veuillez vous connecter d'abord.", "error");
        if (accueilSection) accueilSection.classList.add('hidden');
        if (sectionsWrapper) sectionsWrapper.classList.remove('hidden');
        allSections.forEach(sec => sec.classList.toggle('hidden', sec.id !== sectionId));
        if (sectionId === 'sommeil') { updateSleepInfo(); }
        if (sectionId === 'recapitulatif') {
            const growthData = await fetchGrowthData();
            if (growthData && growthData.labels.length > 1) {
                renderGrowthChart(growthData);
            } else {
                const chartContainer = document.querySelector('#recapitulatif .chart-container');
                if (chartContainer) chartContainer.innerHTML = "<p style='text-align:center;'>Pas assez de données pour afficher un graphique.<br>Enregistrez au moins deux mesures de poids ou de taille.</p>";
            }
        }
        if (!fromHistory) { history.pushState({ section: sectionId }, '', `#${sectionId}`); }
    }
    function showHome(fromHistory = false) {
        if (accueilSection) accueilSection.classList.remove('hidden');
        if (sectionsWrapper) sectionsWrapper.classList.add('hidden');
        if (!fromHistory) { history.pushState({ section: 'accueil' }, '', location.pathname.split('#')[0]); }
    }
    categoryButtons.forEach(button => button.addEventListener('click', () => showSection(button.dataset.section)));
    returnButtons.forEach(button => button.addEventListener('click', () => history.back()));
    window.addEventListener('popstate', (event) => {
        const section = event.state?.section || 'accueil';
        if (section === 'accueil') { showHome(true); } else { showSection(section, true); }
    });
    
    const settingsModal = document.getElementById('settings-modal');
    const settingsButton = document.getElementById('settings-button');
    const closeButton = settingsModal.querySelector('.close-button');
    const settingsForm = document.getElementById('form-settings');
    if(settingsButton) settingsButton.addEventListener('click', () => {
        if (!currentUser) return showMessage('Veuillez vous connecter d\'abord.', 'error');
        settingsModal.classList.remove('hidden');
    });
    if(closeButton) closeButton.addEventListener('click', () => settingsModal.classList.add('hidden'));
    window.addEventListener('click', (event) => { if (event.target == settingsModal) { settingsModal.classList.add('hidden'); } });

    if(settingsForm) settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser) return showMessage('Veuillez vous connecter.', 'error');
        const nom = document.getElementById('input-bebe-nom').value;
        const dob = document.getElementById('input-bebe-dob').value;
        try {
            await db.collection('users').doc(currentUser.uid).set({ prenom: nom, naissance: dob }, { merge: true });
            showMessage('✅ Paramètres enregistrés !');
            settingsModal.classList.add('hidden');
            loadInitialData();
        } catch (error) { console.error("Erreur de sauvegarde des paramètres:", error); showMessage('❌ Erreur de sauvegarde des paramètres.', 'error'); }
    });
    
    document.querySelectorAll('.bouton-now').forEach(btn => {
        const btnId = btn.id.split('-');
        let section = btnId[2];
        if (btnId.length > 3) section = btnId[2] + '-' + btnId[3];
        let dateId = `date-${btnId[2]}`;
        let timeId = `heure-${btnId[2]}`;
        if (section === 'sommeil-fin') { dateId = 'date-fin-sommeil'; timeId = 'heure-fin-sommeil'; }
        if (section === 'sante' || section === 'hygiene' || section === 'remarques') { timeId = null; }
        btn.addEventListener('click', () => fillCurrentDateTime(dateId, timeId));
    });

    const coteInputAllaitement = document.getElementById('cote-allaitement');
    const chronoDisplayAllaitement = document.getElementById('chrono-display');
    let intervalAllaitement = null;
    document.querySelectorAll('#form-allaitement .choice-button').forEach(b => b.addEventListener('click', () => { coteInputAllaitement.value = b.dataset.cote; document.querySelectorAll('#form-allaitement .choice-button').forEach(btn => btn.classList.remove('selected')); b.classList.add('selected'); }));
    document.getElementById('start-chrono-allaitement').addEventListener('click', () => { if (intervalAllaitement) return; const startTime = Date.now(); intervalAllaitement = setInterval(() => { const elapsed = new Date(Date.now() - startTime); chronoDisplayAllaitement.textContent = `${String(elapsed.getUTCMinutes()).padStart(2, '0')}:${String(elapsed.getUTCSeconds()).padStart(2, '0')}`; }, 1000); });
    document.getElementById('stop-chrono-allaitement').addEventListener('click', () => { clearInterval(intervalAllaitement); intervalAllaitement = null; });

    const typeLaitInput = document.getElementById('type-lait');
    document.querySelectorAll('#form-biberon .choice-button').forEach(b => b.addEventListener('click', () => { typeLaitInput.value = b.dataset.lait; document.querySelectorAll('#form-biberon .choice-button').forEach(btn => btn.classList.remove('selected')); b.classList.add('selected'); }));

    const selleCheckbox = document.getElementById('check-selle');
    if (selleCheckbox) selleCheckbox.addEventListener('change', () => document.getElementById('details-selle').classList.toggle('hidden', !selleCheckbox.checked));
    const couleurSelect = document.getElementById('couleur-couche');
    if (couleurSelect) couleurSelect.addEventListener('change', (e) => document.getElementById('autre-couleur-wrapper').classList.toggle('hidden', e.target.value !== 'autres'));

    const coteInputTireLait = document.getElementById('cote-tire-lait');
    const chronoDisplayTireLait = document.getElementById('chrono-display-tire-lait');
    let intervalTireLait = null;
    document.querySelectorAll('#form-tire-lait .choice-button').forEach(b => b.addEventListener('click', () => { const cote = b.dataset.cote; coteInputTireLait.value = cote; document.querySelectorAll('#form-tire-lait .choice-button').forEach(btn => btn.classList.remove('selected')); b.classList.add('selected'); document.getElementById('quantite-gauche-wrapper').classList.toggle('hidden', cote !== 'gauche' && cote !== 'les_deux'); document.getElementById('quantite-droite-wrapper').classList.toggle('hidden', cote !== 'droit' && cote !== 'les_deux'); }));
    document.getElementById('start-chrono-tire-lait').addEventListener('click', () => { if (intervalTireLait) return; const startTime = Date.now(); intervalTireLait = setInterval(() => { const elapsed = new Date(Date.now() - startTime); chronoDisplayTireLait.textContent = `${String(elapsed.getUTCMinutes()).padStart(2, '0')}:${String(elapsed.getUTCSeconds()).padStart(2, '0')}`; }, 1000); });
    document.getElementById('stop-chrono-tire-lait').addEventListener('click', () => { clearInterval(intervalTireLait); intervalTireLait = null; });
  
    const maladeStatusInput = document.getElementById('malade-status');
    document.querySelectorAll('#form-sante .choice-button').forEach(b => b.addEventListener('click', () => { maladeStatusInput.value = b.dataset.malade; document.querySelectorAll('#form-sante .choice-button').forEach(btn => btn.classList.remove('selected')); b.classList.add('selected'); }));

    document.getElementById('form-allaitement').addEventListener('submit', function (e) { e.preventDefault(); if (!coteInputAllaitement.value) return showMessage('Veuillez sélectionner un côté.', 'error'); envoyerDonnees({ type: 'allaitement', date: this.elements['date-allaitement'].value, heure: this.elements['heure-allaitement'].value, dureeFormat: chronoDisplayAllaitement.textContent, cote: coteInputAllaitement.value, remarque: this.elements['remarques-allaitement'].value }); this.reset(); chronoDisplayAllaitement.textContent = "00:00"; document.querySelectorAll('#form-allaitement .choice-button').forEach(b => b.classList.remove('selected')); });
    document.getElementById('form-biberon').addEventListener('submit', function (e) { e.preventDefault(); if (!typeLaitInput.value) return showMessage('Veuillez sélectionner un type de lait.', 'error'); envoyerDonnees({ type: 'biberon', date: this.elements['date-biberon'].value, heure: this.elements['heure-biberon'].value, typeLait: typeLaitInput.value, quantitePreparee: this.elements['quantite-preparee'].value, quantiteBue: this.elements['quantite-bue'].value, remarque: this.elements['remarques-biberon'].value }); this.reset(); document.querySelectorAll('#form-biberon .choice-button').forEach(b => b.classList.remove('selected')); });
    document.getElementById('form-couche').addEventListener('submit', function (e) { e.preventDefault(); const isPipi = this.elements['check-pipi'].checked, isSelle = this.elements['check-selle'].checked; if (!isPipi && !isSelle) return showMessage('Veuillez cocher Pipi et/ou Selle.', 'error'); let categorie = (isPipi && isSelle) ? 'mixte' : (isPipi ? 'pipi' : 'selle'); let couleurValue = '', consistanceValue = ''; if (isSelle) { couleurValue = this.elements['couleur-couche'].value; if (couleurValue === 'autres') { couleurValue = `Autre: ${document.getElementById('autre-couleur-input').value}`; } consistanceValue = this.elements['consistance-selle'].value; } envoyerDonnees({ type: 'couche', date: this.elements['date-couche'].value, heure: this.elements['heure-couche'].value, categorie, couleur: couleurValue, consistance: consistanceValue, remarque: this.elements['remarques-couche'].value }); this.reset(); document.getElementById('details-selle').classList.add('hidden'); document.getElementById('autre-couleur-wrapper').classList.add('hidden'); });
    document.getElementById('form-tire-lait').addEventListener('submit', function (e) { e.preventDefault(); if (!coteInputTireLait.value) return showMessage('Veuillez sélectionner un côté.', 'error'); envoyerDonnees({ type: 'tire-lait', date: this.elements['date-tire-lait'].value, heure: this.elements['heure-tire-lait'].value, cote: coteInputTireLait.value, qteGauche: this.elements['quantite-gauche'].value, qteDroite: this.elements['quantite-droite'].value, duree: chronoDisplayTireLait.textContent, remarque: this.elements['remarques-tire-lait'].value }); this.reset(); chronoDisplayTireLait.textContent = '00:00'; document.querySelectorAll('#form-tire-lait .choice-button').forEach(b => b.classList.remove('selected')); document.getElementById('quantite-gauche-wrapper').classList.add('hidden'); document.getElementById('quantite-droite-wrapper').classList.add('hidden'); });
    document.getElementById('start-sleep-btn').addEventListener('click', () => { const now = new Date(); const eventData = { type: 'sommeil', heureDebut: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}` }; envoyerDonnees(eventData); });
    document.getElementById('form-sleep-end').addEventListener('submit', function (e) { e.preventDefault(); const eventData = { type: 'sommeil', heureFin: this.elements['heure-fin-sommeil'].value, remarque: this.elements['remarques-sommeil'].value }; envoyerDonnees(eventData); this.reset(); });
    document.getElementById('form-sante').addEventListener('submit', function (e) { e.preventDefault(); envoyerDonnees({ type: 'sante', date: this.elements['date-sante'].value, malade: maladeStatusInput.value === 'oui', temperature: this.elements['temperature'].value, poids: this.elements['poids'].value, taille: this.elements['taille'].value, remarque: this.elements['remarques-sante'].value }); this.reset(); document.querySelectorAll('#form-sante .choice-button').forEach(b => b.classList.remove('selected')); maladeStatusInput.value = ''; });
    document.getElementById('form-humeur').addEventListener('submit', function (e) { e.preventDefault(); envoyerDonnees({ type: 'humeur', date: this.elements['date-humeur'].value, heure: this.elements['heure-humeur'].value, humeur: this.elements['select-humeur'].value, remarque: this.elements['remarques-humeur'].value }); this.reset(); });
    document.getElementById('form-hygiene').addEventListener('submit', function(e) { e.preventDefault(); envoyerDonnees({ type: 'hygiene', date: this.elements['date-hygiene'].value, bain: this.elements['check-bain'].checked, dents: this.elements['check-dents'].checked, serum: this.elements['check-serum'].checked, moucheBebe: this.elements['check-mouche-bebe'].checked, remarque: this.elements['remarques-hygiene'].value }); this.reset(); });
    document.getElementById('form-remarques').addEventListener('submit', function (e) { e.preventDefault(); envoyerDonnees({ type: 'remarques', date: this.elements['date-remarques'].value, remarque: this.elements['texte-remarques'].value }); this.reset(); });
  
    document.getElementById('get-recap-gemini-button')?.addEventListener('click', function() {
        showMessage("Cette fonctionnalité nécessite une Cloud Function et sera bientôt disponible.", "info");
    });
}