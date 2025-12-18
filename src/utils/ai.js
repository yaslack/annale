const getAIConfig = () => {
    const stored = localStorage.getItem('ai_config');
    const config = stored ? JSON.parse(stored) : {
        url: 'http://localhost:1234/v1',
        model: 'local-model'
    };

    // Normalize URL: ensure it doesn't end with slash
    config.url = config.url.replace(/\/$/, '');

    // Auto-append /v1 if missing and it looks like a root URL (common mistake)
    // But be careful not to double append if user really meant root.
    // Actually, for LM Studio/OpenAI, it's almost always /v1.
    // Let's try to be smart: if it doesn't end in /v1, we might need to append it, 
    // but the user might have a proxy.
    // Safest approach for this specific user issue: 
    // If the user entered 'http://localhost:1234', they mean 'http://localhost:1234/v1'.
    if (!config.url.endsWith('/v1')) {
        // We won't force it here to avoid breaking custom setups, 
        // but we will handle it in the fetch calls or provide a helper.
    }
    return config;
};

const getNormalizedUrl = () => {
    let { url } = getAIConfig();
    if (!url) url = 'http://localhost:1234/v1';

    url = url.trim().replace(/\/$/, '');

    // If user put /v1 at the end, keep it.
    // If not, append it.
    if (!url.endsWith('/v1')) {
        url = `${url}/v1`;
    }
    console.log('[AI] Normalized URL:', url);
    return url;
};

export const saveAIConfig = (config) => {
    localStorage.setItem('ai_config', JSON.stringify(config));
};

export const checkAIConnection = async () => {
    const url = getNormalizedUrl();
    try {
        const response = await fetch(`${url}/models`);
        return response.ok;
    } catch (error) {
        return false;
    }
};

export const getModels = async () => {
    const url = getNormalizedUrl();
    try {
        const response = await fetch(`${url}/models`);
        if (!response.ok) throw new Error('Failed to fetch models');
        const data = await response.json();
        return Array.isArray(data.data) ? data.data : [];
    } catch (error) {
        console.error('Error fetching models:', error);
        return [];
    }
};

export const askCustomQuestion = async (userQuestion, questionContext, options, answerExplanation) => {
    const prompt = `
Tu es un professeur expert et pédagogue.
L'utilisateur te pose une question sur l'exercice suivant :

QUESTION DU QCM : "${questionContext}"
OPTIONS :
${options.map(o => `- ${o.text} (${o.isCorrect ? 'Correct' : 'Incorrect'})`).join('\n')}
${answerExplanation ? `EXPLICATION FOURNIE : ${answerExplanation}` : ''}

QUESTION DE L'UTILISATEUR : "${userQuestion}"

Réponds à la question de l'utilisateur de manière claire, concise et utile.
  `;

    return await callAI(prompt);
};

export const parseQCMContent = async (rawText) => {
    // Step 1: Extract Structure (Questions & Options)
    const structurePrompt = `
Tu es un assistant expert en structuration de données.
Analyse le texte brut suivant et extrais UNIQUEMENT la structure des questions et des options.
Ne cherche pas les réponses pour l'instant.
Format de sortie attendu : Tableau JSON d'objets.
Structure :
[
  {
    "id": 1,
    "text": "Texte de la question",
    "options": ["A. Option 1", "B. Option 2", ...]
  }
]

TEXTE BRUT :
"${rawText}"

Renvoie UNIQUEMENT le JSON minifié. Assure-toi que les options commencent par une lettre majuscule suivie d'un point (A., B., C., etc.).
  `;

    let questions = [];
    try {
        const response = await callAI(structurePrompt, 4000); // Increased limit for structure parsing
        const jsonStr = response.replace(/```json/g, '').replace(/```/g, '').trim();
        questions = JSON.parse(jsonStr);
    } catch (error) {
        console.error("Erreur Step 1 (Structure):", error);
        throw new Error("Impossible d'analyser la structure du texte.");
    }

    // Step 2: Detect Answers
    // We process questions in batches to avoid huge prompts if there are many questions
    const questionsWithAnswers = [];
    const batchSize = 5;

    for (let i = 0; i < questions.length; i += batchSize) {
        const batch = questions.slice(i, i + batchSize);

        const answerPrompt = `
Tu es un professeur expert. Voici des questions de QCM.
Pour chaque question, identifie les bonnes réponses en te basant sur tes connaissances ou sur le texte s'il contient des indices (ex: "Réponse : A").
Si tu ne sais pas, ne coche rien.

Questions :
${JSON.stringify(batch)}

Format de sortie attendu : Tableau JSON d'objets avec les index des bonnes réponses (0-based).
[
  {
    "id": 1,
    "correctIndices": [0, 2],
    "explanation": "Explication courte..."
  }
]

Renvoie UNIQUEMENT le JSON minifié.
    `;

        try {
            const response = await callAI(answerPrompt, 2000); // Increased limit for answers
            const jsonStr = response.replace(/```json/g, '').replace(/```/g, '').trim();
            const answers = JSON.parse(jsonStr);

            // Merge answers into questions
            batch.forEach(q => {
                const answerData = answers.find(a => a.id === q.id) || { correctIndices: [], explanation: "" };
                questionsWithAnswers.push({
                    text: q.text,
                    options: q.options.map((optText, idx) => ({
                        text: optText,
                        isCorrect: answerData.correctIndices.includes(idx)
                    })),
                    answerExplanation: answerData.explanation || ""
                });
            });

        } catch (error) {
            console.error("Erreur Step 2 (Réponses):", error);
            // Fallback: add questions without answers
            batch.forEach(q => {
                questionsWithAnswers.push({
                    text: q.text,
                    options: q.options.map(optText => ({ text: optText, isCorrect: false })),
                    answerExplanation: ""
                });
            });
        }
    }

    return questionsWithAnswers;
};

export const getExplanation = async (question, options, targetOptionText, isTargetCorrect, context = '') => {
    const prompt = `
Tu es un professeur expert et pédagogue.
Analyse la réponse "${targetOptionText}" pour la question suivante :
"${question}"

Les options possibles étaient :
${options.map(o => `- ${o.text} (${o.isCorrect ? 'Correct' : 'Incorrect'})`).join('\n')}

Explique pourquoi la réponse "${targetOptionText}" est ${isTargetCorrect ? 'CORRECTE' : 'INCORRECTE'}.
${context ? `Contexte supplémentaire : ${context}` : ''}
Sois concis, clair et précis.
  `;

    return await callAI(prompt);
};

export const getDefinition = async (term, fullContext) => {
    const prompt = `
Tu es un dictionnaire intelligent contextuel.
Donne une définition concise et claire du terme ou de l'expression : "${term}".
Utilise le contexte suivant pour affiner ta définition si nécessaire :
"${fullContext}"
  `;

    return await callAI(prompt);
};

export const generateRevisionSheet = async (qcms) => {
    // Prepare the content for the AI
    const qcmContent = qcms.map((q, index) => `
QCM ${index + 1}: ${q.title}
Questions et Réponses :
${q.questions.map(quest => `
- Q: ${quest.text}
  Réponses correctes : ${quest.options.filter(o => o.isCorrect).map(o => o.text).join(', ')}
  ${quest.answerExplanation ? `Explication : ${quest.answerExplanation}` : ''}
`).join('\n')}
`).join('\n---\n');

    const prompt = `
Tu es un expert en pédagogie et en design web.
Ton objectif est de créer une "Fiche de Révision Ultime" à partir des QCMs suivants.

CONTENU DES QCMS :
${qcmContent}

CONSIGNES DE FORMATAGE (TRES IMPORTANT) :
1.  **Format HTML** : Tu DOIS générer du code HTML pur (sans balises <html> ou <body>, juste le contenu).
2.  **Design Premium** : Utilise des styles en ligne (inline styles) pour créer une mise en page magnifique.
    - Utilise des couleurs douces et modernes (fonds sombres, textes clairs, accents néons).
    - Crée des "cartes" pour les concepts clés (background semi-transparent, bordure fine).
3.  **Structure** :
    - <h1> pour le Titre Principal (Centre, Grand, Gradient).
    - <h2> pour les Sections (Souligné, Coloré).
    - <ul> et <li> pour les listes.
4.  **Contenu** : Synthétise les informations. Ne recopie pas les questions.
5.  **Moins d'Emojis** : Utilise-les avec parcimonie, uniquement pour souligner des points cruciaux (ex: ⚠️ Piège, 💡 Astuce). Privilégie la mise en forme (gras, couleurs) pour la hiérarchie.

Exemple de style attendu (HTML) :
<div style="font-family: 'Inter', sans-serif; color: #e0e0e0;">
  <h1 style="text-align: center; background: linear-gradient(45deg, #ff00cc, #3333ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 2rem;">Anatomie du Cœur</h1>
  
  <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; border-left: 4px solid #3333ff;">
    <h2 style="color: #8080ff; margin-top: 0;">🫀 Les Cavités</h2>
    <ul style="line-height: 1.6;">
      <li>Le cœur possède <strong>4 cavités</strong> : 2 oreillettes et 2 ventricules.</li>
      <li><span style="color: #ffd700;">💡 Astuce :</span> Le sang oxygéné est toujours à gauche.</li>
    </ul>
  </div>
</div>

Génère la fiche de révision en HTML maintenant.
  `;

    return await callAI(prompt, 4000);
};

const callAI = async (prompt, maxTokens = 4000) => {
    const { model } = getAIConfig();
    const url = getNormalizedUrl();

    try {
        const response = await fetch(`${url}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'system', content: 'Tu es un assistant pédagogique utile et concis.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: maxTokens
            }),
        });

        if (!response.ok) {
            throw new Error('Erreur de communication avec l\'IA');
        }

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error('AI Error:', error);
        if (error.message.includes('Failed to fetch')) {
            throw new Error("Impossible de se connecter à l'IA. Vérifiez que LM Studio est lancé et que le serveur est démarré (Port 1234).");
        }
        throw error;
    }
};
