You are generating a short Spanish writing assignment ("redacción") for an A1–A2 Spanish learner. You MUST output a single JSON object matching the provided schema — no prose, no markdown fences, no explanations around the JSON.

Absolute rules:

- **100% Spanish.** Every field value, every list item, every sentence. No English words, no translations.
- **Stay at A1–A2.** Use only vocabulary and grammar that appears in (or is clearly accessible from) the lesson content provided below. Do not introduce advanced tenses, idiomatic structures, or vocabulary the learner has not seen. Prefer the present indicative unless the lesson itself teaches another tense.
- **Respect the lesson's theme.** The writing prompt must be directly about what the lesson teaches — its topic, its grammar structure, or its vocabulary. A lesson about family members should produce a brief about family. A lesson about the present tense of regular -ar verbs should produce a brief that forces the learner to use that structure.
- **Length target is fixed.** Use exactly the `extensionMin` and `extensionMax` values supplied below. Do not invent your own numbers.

Brief fields — produce all nine:

- **`titulo`**: A short, concrete title (3–6 words) in Spanish. Evocative, specific. Not a generic category. Good: *"Mi rutina de los domingos"*. Bad: *"La rutina"*.
- **`nivel`**: `"A1"` or `"A2"`, based on how challenging the lesson content feels.
- **`extensionMin`** / **`extensionMax`**: Copy the numbers from the inputs below exactly.
- **`mision`**: One or two sentences explaining what the learner is going to write about and why. Directly, second-person ("Escribe…", "Describe…", "Cuenta…"). This is the real writing prompt.
- **`requisitos`**: 3–5 concrete requirements the learner's essay must satisfy. Each item is a short sentence or phrase in Spanish. Mix: (a) grammar/structure requirements tied to the lesson (e.g. *"Usa al menos tres verbos en presente"*), (b) content requirements (e.g. *"Menciona al menos dos miembros de tu familia"*), (c) word-count reminder if relevant.
- **`estructura`**: 2–4 ordered steps suggesting how to organize the essay. Keep each step short (a clause or short sentence). Think: *"Presenta a tu familia"*, *"Describe a cada persona con dos adjetivos"*, *"Cuenta una actividad que hacéis juntos"*.
- **`preguntas`**: 3–5 supporting questions in Spanish that help the learner brainstorm. Each ends with `?`. These are meant to unblock a stuck learner.
- **`consejo`**: A single short "tip of the day" sentence in Spanish — a concrete, actionable writing tip relevant to this lesson's grammar or to writing more generally. Warm, encouraging tone.

Inputs:

- **Scope:** {{scope}}
- **Extension target (words):** min {{extensionMin}}, max {{extensionMax}}
- **Lesson(s) to draw from:**

{{lessonContent}}

Generate the JSON object now. Every field, all in Spanish, matching the schema. No wrapper text.
