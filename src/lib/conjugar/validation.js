/**
 * Answer validation and session builder for Conjugar drills.
 */

// ── Normalize ──

export function normalizeAnswer(str) {
  return (str || "").trim().toLowerCase();
}

// ── Per-type checkers ──

function checkClassicTable(exercise, answers) {
  const persons = Object.keys(exercise.answers);
  const details = {};
  let correctCount = 0;
  for (const person of persons) {
    const expected = normalizeAnswer(exercise.answers[person]);
    const actual = normalizeAnswer(answers?.[person]);
    const isCorrect = actual === expected;
    if (isCorrect) correctCount++;
    details[person] = { correct: isCorrect, expected: exercise.answers[person] };
  }
  return { correct: correctCount >= 4, correctCount, total: persons.length, details };
}

function checkGapFill(exercise, answer) {
  const correct = normalizeAnswer(answer) === normalizeAnswer(exercise.correctAnswer);
  return { correct, expected: exercise.correctAnswer };
}

function checkSpotError(exercise, selectedIndex) {
  return {
    correct: selectedIndex === exercise.errorIndex,
    errorIndex: exercise.errorIndex,
    correctWord: exercise.correctWord,
    explanation: exercise.explanation,
  };
}

function checkMultipleChoice(exercise, selectedIndex) {
  return {
    correct: selectedIndex === exercise.correctIndex,
    correctIndex: exercise.correctIndex,
  };
}

function checkChatBubble(exercise, answer) {
  const correct = normalizeAnswer(answer) === normalizeAnswer(exercise.correctAnswer);
  return { correct, expected: exercise.correctAnswer };
}

function checkOddOneOut(exercise, selectedIndex) {
  return {
    correct: selectedIndex === exercise.oddIndex,
    oddIndex: exercise.oddIndex,
    explanation: exercise.explanation,
  };
}

function checkMiniStory(exercise, answers) {
  const blanks = exercise.segments.filter((s) => s.isBlank);
  let correctCount = 0;
  const details = blanks.map((blank, i) => {
    const isCorrect =
      normalizeAnswer(answers?.[i]) === normalizeAnswer(blank.correctAnswer);
    if (isCorrect) correctCount++;
    return { correct: isCorrect, expected: blank.correctAnswer };
  });
  const threshold = Math.ceil((blanks.length * 2) / 3);
  return { correct: correctCount >= threshold, correctCount, total: blanks.length, details };
}

// ── Main dispatcher ──

export function checkExercise(exercise, userAnswer) {
  switch (exercise.type) {
    case "classic_table":
      return checkClassicTable(exercise, userAnswer);
    case "gap_fill":
      return checkGapFill(exercise, userAnswer);
    case "spot_error":
      return checkSpotError(exercise, userAnswer);
    case "multiple_choice":
      return checkMultipleChoice(exercise, userAnswer);
    case "chat_bubble":
      return checkChatBubble(exercise, userAnswer);
    case "odd_one_out":
      return checkOddOneOut(exercise, userAnswer);
    case "mini_story":
      return checkMiniStory(exercise, userAnswer);
    default:
      return { correct: false };
  }
}

// ── Session builder ──

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildSession(packs) {
  const classics = [];
  const creativesByPack = {};

  for (const pack of packs) {
    const verbName = pack.exercises.find((e) => e.verb)?.verb || "";
    creativesByPack[pack.id] = [];

    for (const ex of pack.exercises) {
      const enriched = {
        ...ex,
        _packId: pack.id,
        _verbId: pack.verb_id,
        _verb: verbName,
        _tense: pack.tense,
      };
      if (ex.type === "classic_table") {
        classics.push(enriched);
      } else {
        creativesByPack[pack.id].push(enriched);
      }
    }
  }

  // Shuffle each pack's creatives
  for (const key in creativesByPack) {
    creativesByPack[key] = shuffle(creativesByPack[key]);
  }

  // Pull creatives evenly via round-robin
  const creativeSlots = 15 - classics.length;
  const selected = [];
  const packKeys = Object.keys(creativesByPack);
  let robin = 0;

  while (selected.length < creativeSlots && robin < 100) {
    const key = packKeys[robin % packKeys.length];
    if (creativesByPack[key].length > 0) {
      selected.push(creativesByPack[key].shift());
    }
    robin++;
  }

  const shuffled = shuffle(selected);

  // Insert classic tables at evenly distributed positions
  const session = [...shuffled];
  for (let i = 0; i < classics.length; i++) {
    const pos = Math.round(((i + 0.5) / classics.length) * session.length);
    session.splice(Math.min(pos, session.length), 0, classics[i]);
  }

  return session.slice(0, 15);
}
