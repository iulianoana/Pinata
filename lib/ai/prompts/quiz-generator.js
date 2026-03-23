/**
 * @param {number} numberOfQuestions
 * @returns {string}
 */
export function getQuizPrompt(numberOfQuestions = 15) {
  return `## Variables

> NUMBER_OF_QUESTIONS = ${numberOfQuestions}

I'm uploading a Spanish lesson PDF from my language course. Your job is to create a quiz JSON file with exactly **${numberOfQuestions}** questions that test ONLY the material presented in this PDF.

---

## CRITICAL RULES — READ BEFORE ANYTHING ELSE

### 1. ONLY USE WHAT'S IN THE PDF

- Every question you create MUST trace back to a specific page, exercise, dialogue, vocabulary list, or grammar rule in the PDF.
- If a phrase, sentence, vocabulary word, or grammar concept does NOT appear in the PDF, do NOT use it.
- Do NOT invent Spanish sentences. Do NOT rephrase or paraphrase content that isn't in the PDF. Do NOT generate new example sentences that "follow the pattern" — use the ACTUAL sentences, vocabulary, and exercises from the PDF.
- If the PDF has a fill-in-the-blank exercise, you can adapt it. If the PDF has a dialogue, you can quiz on it. If the PDF lists vocabulary, you can test it. But do NOT go beyond what's there.

### 2. EVERY QUESTION MUST HAVE A \`title\` FIELD

- Every single question object, regardless of type, MUST include a \`title\` field.
- The title is a short, clear label (5-15 words) that tells the student what they're being tested on.
- Examples: "Pronunciation rules for the letter C", "Vocabulary: professions and workplaces", "Grammar: expressing nationality with 'Soy'"
- If you forget the title on even ONE question, the entire output is invalid.

### 3. SOURCE YOUR QUESTIONS FROM THESE (IN ORDER OF PRIORITY)

1. **Exercises that already exist in the PDF** — The PDF contains exercises with answer keys. Adapt these directly. They are already at the right level and use the right vocabulary.
2. **Dialogues and example texts** — Use sentences from dialogues as fill-in-the-blank or translation material. Test the LANGUAGE used in dialogues (vocabulary, grammar structures, key phrases), NOT character trivia (who said what, who works where, what someone's hobbies are).
3. **Vocabulary lists** — The PDF presents specific vocabulary. Test THESE specific words, not others you think might be related.
4. **Grammar rules explicitly taught** — Only test grammar rules the PDF explicitly explains with examples.

### 4. WHAT TO TEST vs. WHAT NOT TO TEST

The quiz tests the student's knowledge of **Spanish language** — vocabulary, grammar, pronunciation rules, sentence structures. It does NOT test the student's memory of storylines, character details, or plot points.

- **YES**: Complete a sentence using the correct grammar structure (tests language knowledge)
- **NO**: "What is [character]'s profession?" (tests memory of a character's bio, not Spanish)
- **YES**: "Which verb ending does 'cocinar' have? -AR / -ER / -IR" (tests grammar knowledge)
- **NO**: "What are [character]'s hobbies?" (tests recall of a character's details)
- **YES**: Translate a key phrase from the lesson (tests vocabulary and comprehension)
- **NO**: "Where is [character] from?" (tests recall of plot details)

If the PDF uses characters or dialogues, use them as CONTEXT for testing Spanish — not as trivia questions about the characters themselves.

### 5. DO NOT DO ANY OF THESE

- Do NOT create questions that require knowledge beyond what's in this specific lesson.
- Do NOT invent fill-in-the-blank sentences that don't come from the PDF's dialogues, exercises, or example texts.
- Do NOT create translation questions for phrases that don't appear in the PDF.
- Do NOT test vocabulary words that aren't explicitly listed or used in the PDF.
- Do NOT create questions in English about Spanish concepts if the PDF teaches them in Spanish.
- Do NOT ask open-ended or subjective questions.
- Do NOT include questions about regional dialect content (voseo, slang) unless the PDF explicitly teaches it — and even then, keep it low priority.
- Do NOT create math/arithmetic questions (e.g., "siete x siete = \\_\\_\\_"). Numbers should be tested through vocabulary recognition or translation, NOT through math problems.
- Do NOT prefix prompts with meta-labels like "From the exercises:", "From the dialogue:", "Complete Carolina's introduction:". The prompt should read naturally as a standalone question or sentence to complete.

---

## Output Format

Return ONLY valid JSON (no markdown fences, no explanation). Schema:

\`\`\`
{
  "meta": {
    "title": "Lección X: [Title from PDF]",
    "description": "[Brief summary of topics covered]",
    "unit": [number],
    "lesson": [number]
  },
  "questions": [ ... ]
}
\`\`\`

---

## Question Types (use a balanced mix of all 4)

### 1. fill_blank

Fill in the blank — use \`___\` in the prompt where blanks go.

\`\`\`
{
  "type": "fill_blank",
  "title": "Short descriptive title of what this tests",
  "prompt": "Natural sentence with ___ for each blank",
  "blanks": ["CorrectAnswer1", "CorrectAnswer2"],
  "accept": [["answer1variant1", "answer1variant2"], ["answer2variant1"]],
  "hint": "Brief clue about what kind of answer is expected",
  "explanation": "Why this is the answer, with teaching context"
}
\`\`\`

- \`blanks\`: the primary correct answer for each blank (displayed in review)
- \`accept\`: array of arrays — each inner array lists ALL accepted spellings/variants for that blank (LOWERCASE — matching is case-insensitive and accent-insensitive)
- **The sentence MUST come from the PDF** — from a dialogue, exercise, or example text. Do not invent sentences.

**FILL_BLANK FORMATTING RULES (critical):**

- The \`prompt\` must read as a natural, self-contained sentence or question. The student should understand what's being asked just by reading the prompt.
- Do NOT start prompts with meta-prefixes like "From the exercises:", "Complete the dialogue:", "From page 12:". Just write the sentence directly.
- \`hint\` is **MANDATORY** for fill_blank questions. The hint should clarify what TYPE of answer is expected (e.g., "nationality", "profession", "a greeting", "a verb in infinitive form"). Without a hint, the student often has no idea what category of word to fill in.
- Each blank should test exactly ONE word or short phrase. Do not make blanks that expect entire sentences.
- BAD: \`"___, ___."\` (two disconnected blanks with no context — student has no idea what's expected)
- GOOD: \`"___ colombiana, de Bogotá. ___ médica clínica."\` (the surrounding words give clear context for each blank)
- BAD: \`"El queso Camembert es ___. El vodka es ___."\` (what adjective? what nationality? what quality? unclear)
- GOOD: \`"La pizza es ___. La paella es ___."\` with hint: \`"Fill in the nationality that matches each food's country of origin."\` (now it's clear)

### 2. multiple_choice

\`\`\`
{
  "type": "multiple_choice",
  "title": "Short descriptive title of what this tests",
  "prompt": "The question text",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "answer": 1,
  "explanation": "Why this is the answer"
}
\`\`\`

- \`answer\`: zero-indexed integer (0 = first option)
- Always 4 options
- Distractors must be plausible (from the same vocabulary set in the PDF), not obviously wrong

### 3. translate

\`\`\`
{
  "type": "translate",
  "title": "Short descriptive title of what this tests",
  "prompt": "Translate to [target language]: '[phrase]'",
  "direction": "English → Spanish" or "Spanish → English",
  "accept": ["variant1", "variant2", "variant3"],
  "hint": "optional hint",
  "explanation": "Why this is the answer"
}
\`\`\`

- \`accept\`: list ALL reasonable variants — with/without accents, with/without punctuation marks, alternate valid phrasings
- The phrase being translated MUST appear in the PDF (dialogue, exercise, vocabulary section, or grammar example)
- Use both directions

### 4. classify

Sort items into categories.

\`\`\`
{
  "type": "classify",
  "title": "Short descriptive title of what this tests",
  "prompt": "Instruction for classification",
  "categories": {
    "Category A": ["item1", "item2"],
    "Category B": ["item3", "item4"]
  },
  "explanation": "Why these groupings are correct"
}
\`\`\`

- 2-3 categories max
- 3-8 items per category
- ALL items MUST come from the PDF's vocabulary lists or exercises

---

## Question Design Rules

1. **Every question MUST have a \`title\`** — a short label describing what's being tested. This is mandatory. No exceptions.
2. **Every question MUST have an \`explanation\`** — shown during review, should teach the concept, not just restate the answer.
3. **Pull DIRECTLY from the PDF** — use the actual vocabulary, actual dialogues, actual exercises, and actual grammar points. If the PDF has an exercise about classifying C/G pronunciation, make a classify question using the SAME words from that exercise.
4. **Difficulty mix** — roughly 25% easy, 50% medium, 25% hard. But "hard" means combining concepts FROM THE PDF, not inventing new ones.
5. **Balance the types** — distribute across fill_blank, multiple_choice, translate, and classify.
6. **Hints are MANDATORY for fill_blank, optional for other types** — fill_blank hints should tell the student what category of answer is expected (e.g., "nationality", "profession", "verb form"). For other question types, only add hints for harder questions.
7. **For fill_blank \`accept\` arrays** — think about common misspellings and alternate valid answers. Include accent and non-accent variants.
8. **For translate \`accept\` arrays** — include versions with/without accent marks, with/without inverted question marks, and any alternate valid phrasings that appear in the PDF.
9. **Prioritize the most important concepts** — if the lesson covers 8 topics, pick the 6-7 most important ones. Don't try to cover everything.
10. **Skip regional dialect content** — unless it's a major topic in the lesson, don't make questions about voseo, regional slang, etc.

---

## How to Approach This (Step by Step)

1. **Read the ENTIRE PDF carefully** — every page, every exercise, every answer key.
2. **List the exercises the PDF already contains** — these are your primary source material. The PDF's own exercises are already at the right level with the right vocabulary.
3. **List the key vocabulary** — ONLY what's explicitly presented in vocabulary sections and exercises.
4. **List the grammar structures explicitly taught** — only structures the PDF explains with rules and examples.
5. **List the dialogues and their key phrases** — what questions and answers appear in the conversations.
6. **Now create questions** — drawing ONLY from steps 2-5. Every question should feel like it could have been written by the teacher who made this PDF.

---

## Important

- Output ONLY the JSON. No other text.
- Ensure valid JSON (no trailing commas, proper escaping).
- Use UTF-8 for Spanish characters (ñ, á, é, í, ó, ú, ü, ¿, ¡).
- Every question MUST have a \`title\` field. This is the third time I'm saying it because it's that important.`;
}
