const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");

admin.initializeApp();

// Récupère la clé API depuis la configuration sécurisée
const geminiApiKey = functions.config().gemini.key;
const genAI = new GoogleGenerativeAI(geminiApiKey);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash"});

exports.getGeminiRecap = functions.https.onCall(async (data, context) => {
    // 1. Vérifier que l'utilisateur est bien connecté
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "L'utilisateur doit être connecté.");
    }
    const userId = context.auth.uid;

    // 2. Récupérer les 48 dernières heures d'événements de l'utilisateur
    const now = new Date();
    const cutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const eventsSnapshot = await admin.firestore()
        .collection("events")
        .where("userId", "==", userId)
        .where("createdAt", ">=", cutoff)
        .orderBy("createdAt", "asc")
        .get();

    if (eventsSnapshot.empty) {
        return { summary: "Pas assez de données récentes pour générer un récapitulatif." };
    }

    // 3. Formater les données pour le prompt de Gemini
    let promptText = "Voici les événements des dernières 48h pour un bébé. Formate une synthèse claire, concise et bienveillante en français pour de jeunes parents.\n";

    eventsSnapshot.forEach(doc => {
        const event = doc.data();
        const eventDate = event.createdAt.toDate();
        const timestamp = eventDate.toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit" });

        let description = "";
        switch (event.type) {
            case "biberon": description = `Biberon de ${event.quantiteBue}ml`; break;
            case "sommeil": description = `Sommeil de ${event.heureDebut} à ${event.heureFin || 'maintenant'}`; break;
            // Ajoutez d'autres cas pour chaque type d'événement...
            default: description = `Événement : ${event.type}`; break;
        }
        promptText += `- ${timestamp} : ${description}\n`;
    });

    // 4. Appeler l'API Gemini
    try {
        const result = await model.generateContent(promptText);
        const response = await result.response;
        const summary = response.text();
        return { summary: summary };
    } catch (error) {
        console.error("Erreur de l'API Gemini:", error);
        throw new functions.https.HttpsError("internal", "Erreur lors de la génération du résumé.");
    }
});