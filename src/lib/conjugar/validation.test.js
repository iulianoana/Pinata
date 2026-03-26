import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeAnswer, checkExercise, buildSession } from "./validation.js";

// ── normalizeAnswer ──

describe("normalizeAnswer", () => {
  it("trims whitespace", () => {
    assert.equal(normalizeAnswer("  hablo  "), "hablo");
  });

  it("lowercases", () => {
    assert.equal(normalizeAnswer("Hablo"), "hablo");
  });

  it("preserves accents", () => {
    assert.equal(normalizeAnswer("habló"), "habló");
    assert.notEqual(normalizeAnswer("habló"), "hablo");
  });

  it("handles empty/null", () => {
    assert.equal(normalizeAnswer(""), "");
    assert.equal(normalizeAnswer(null), "");
    assert.equal(normalizeAnswer(undefined), "");
  });
});

// ── classic_table ──

describe("checkExercise: classic_table", () => {
  const exercise = {
    type: "classic_table",
    answers: {
      yo: "hablo",
      tú: "hablas",
      "él/ella/usted": "habla",
      nosotros: "hablamos",
      vosotros: "habláis",
      "ellos/ellas": "hablan",
    },
  };

  it("all correct → correct=true", () => {
    const result = checkExercise(exercise, {
      yo: "hablo", tú: "hablas", "él/ella/usted": "habla",
      nosotros: "hablamos", vosotros: "habláis", "ellos/ellas": "hablan",
    });
    assert.equal(result.correct, true);
    assert.equal(result.correctCount, 6);
  });

  it("case-insensitive match", () => {
    const result = checkExercise(exercise, {
      yo: "Hablo", tú: "HABLAS", "él/ella/usted": "Habla",
      nosotros: "HABLAMOS", vosotros: "Habláis", "ellos/ellas": "HABLAN",
    });
    assert.equal(result.correct, true);
  });

  it("trims whitespace", () => {
    const result = checkExercise(exercise, {
      yo: "  hablo  ", tú: " hablas", "él/ella/usted": "habla ",
      nosotros: "hablamos", vosotros: "habláis", "ellos/ellas": "hablan",
    });
    assert.equal(result.correct, true);
  });

  it("4/6 correct → correct=true (partial credit)", () => {
    const result = checkExercise(exercise, {
      yo: "hablo", tú: "hablas", "él/ella/usted": "habla",
      nosotros: "hablamos", vosotros: "wrong", "ellos/ellas": "wrong",
    });
    assert.equal(result.correct, true);
    assert.equal(result.correctCount, 4);
  });

  it("3/6 correct → correct=false", () => {
    const result = checkExercise(exercise, {
      yo: "hablo", tú: "hablas", "él/ella/usted": "habla",
      nosotros: "wrong", vosotros: "wrong", "ellos/ellas": "wrong",
    });
    assert.equal(result.correct, false);
    assert.equal(result.correctCount, 3);
  });

  it("accent mismatch → incorrect", () => {
    const result = checkExercise(exercise, {
      yo: "hablo", tú: "hablas", "él/ella/usted": "habla",
      nosotros: "hablamos", vosotros: "hablais", "ellos/ellas": "hablan",
    });
    // "hablais" vs "habláis" → wrong
    assert.equal(result.details["vosotros"].correct, false);
    assert.equal(result.correctCount, 5);
  });
});

// ── gap_fill ──

describe("checkExercise: gap_fill", () => {
  const exercise = {
    type: "gap_fill",
    sentence: "María ___ con su madre.",
    correctAnswer: "habla",
    hint: "tercera persona",
  };

  it("exact match → correct", () => {
    assert.equal(checkExercise(exercise, "habla").correct, true);
  });

  it("case-insensitive", () => {
    assert.equal(checkExercise(exercise, "Habla").correct, true);
  });

  it("trimmed", () => {
    assert.equal(checkExercise(exercise, " habla ").correct, true);
  });

  it("wrong answer → incorrect", () => {
    assert.equal(checkExercise(exercise, "hablo").correct, false);
  });
});

// ── spot_error ──

describe("checkExercise: spot_error", () => {
  const exercise = {
    type: "spot_error",
    words: ["Nosotros", "hablas", "mucho"],
    errorIndex: 1,
    errorWord: "hablas",
    correctWord: "hablamos",
    explanation: "hablas is tú, not nosotros",
  };

  it("correct tap", () => {
    const r = checkExercise(exercise, 1);
    assert.equal(r.correct, true);
  });

  it("wrong tap", () => {
    const r = checkExercise(exercise, 0);
    assert.equal(r.correct, false);
    assert.equal(r.errorIndex, 1);
  });
});

// ── multiple_choice ──

describe("checkExercise: multiple_choice", () => {
  const exercise = {
    type: "multiple_choice",
    sentence: "Ellos ___ mucho.",
    options: ["hablan", "hablamos", "habláis", "hablas"],
    correctIndex: 0,
    verb: "hablar",
    tenseLabel: "Presente",
  };

  it("correct selection", () => {
    assert.equal(checkExercise(exercise, 0).correct, true);
  });

  it("wrong selection", () => {
    const r = checkExercise(exercise, 2);
    assert.equal(r.correct, false);
    assert.equal(r.correctIndex, 0);
  });
});

// ── chat_bubble ──

describe("checkExercise: chat_bubble", () => {
  const exercise = {
    type: "chat_bubble",
    messages: [],
    correctAnswer: "hablas",
    person: "tú",
  };

  it("correct answer", () => {
    assert.equal(checkExercise(exercise, "hablas").correct, true);
  });

  it("case-insensitive + trim", () => {
    assert.equal(checkExercise(exercise, "  Hablas  ").correct, true);
  });
});

// ── odd_one_out ──

describe("checkExercise: odd_one_out", () => {
  const exercise = {
    type: "odd_one_out",
    options: ["hablo", "hablas", "hablé", "habla"],
    oddIndex: 2,
    explanation: "hablé is pretérito",
    verb: "hablar",
    tenseLabel: "Presente",
  };

  it("correct pick", () => {
    assert.equal(checkExercise(exercise, 2).correct, true);
  });

  it("wrong pick", () => {
    assert.equal(checkExercise(exercise, 0).correct, false);
  });
});

// ── mini_story ──

describe("checkExercise: mini_story", () => {
  const exercise = {
    type: "mini_story",
    segments: [
      { text: "Todos ", isBlank: false },
      { text: "", isBlank: true, correctAnswer: "hablan" },
      { text: " español. Mi padre ", isBlank: false },
      { text: "", isBlank: true, correctAnswer: "habla" },
      { text: " y mi madre ", isBlank: false },
      { text: "", isBlank: true, correctAnswer: "habla" },
    ],
    hint: "hablar en presente",
    verb: "hablar",
  };

  it("all correct → correct", () => {
    const r = checkExercise(exercise, ["hablan", "habla", "habla"]);
    assert.equal(r.correct, true);
    assert.equal(r.correctCount, 3);
  });

  it("2/3 correct → correct (meets threshold)", () => {
    const r = checkExercise(exercise, ["hablan", "habla", "wrong"]);
    assert.equal(r.correct, true);
    assert.equal(r.correctCount, 2);
  });

  it("1/3 correct → incorrect", () => {
    const r = checkExercise(exercise, ["hablan", "wrong", "wrong"]);
    assert.equal(r.correct, false);
    assert.equal(r.correctCount, 1);
  });

  it("per-blank feedback details", () => {
    const r = checkExercise(exercise, ["hablan", "wrong", "habla"]);
    assert.equal(r.details[0].correct, true);
    assert.equal(r.details[1].correct, false);
    assert.equal(r.details[1].expected, "habla");
    assert.equal(r.details[2].correct, true);
  });
});

// ── buildSession ──

describe("buildSession", () => {
  function makePack(id, exerciseCount = 15) {
    const exercises = [
      { id: `${id}-classic`, type: "classic_table", verb: "hablar", tenseLabel: "Presente", answers: {} },
    ];
    for (let i = 1; i < exerciseCount; i++) {
      exercises.push({ id: `${id}-ex-${i}`, type: "gap_fill", sentence: "test", correctAnswer: "x", hint: "y", person: "yo" });
    }
    return { id, verb_id: `verb-${id}`, tense: "presente", exercises };
  }

  it("returns 15 exercises for 1 pack", () => {
    const session = buildSession([makePack("a")]);
    assert.equal(session.length, 15);
  });

  it("returns 15 exercises for 2 packs", () => {
    const session = buildSession([makePack("a"), makePack("b")]);
    assert.equal(session.length, 15);
  });

  it("returns 15 exercises for 3 packs", () => {
    const session = buildSession([makePack("a"), makePack("b"), makePack("c")]);
    assert.equal(session.length, 15);
  });

  it("includes classic_table from each pack", () => {
    const session = buildSession([makePack("a"), makePack("b")]);
    const classics = session.filter((e) => e.type === "classic_table");
    assert.equal(classics.length, 2);
  });

  it("enriches exercises with pack metadata", () => {
    const session = buildSession([makePack("a")]);
    assert.ok(session.every((e) => e._packId === "a"));
    assert.ok(session.every((e) => e._verb === "hablar"));
  });

  it("classic tables are not all at position 0", () => {
    const session = buildSession([makePack("a"), makePack("b"), makePack("c")]);
    const classicPositions = session
      .map((e, i) => (e.type === "classic_table" ? i : -1))
      .filter((i) => i >= 0);
    // At least one classic should not be at position 0
    assert.ok(classicPositions.some((p) => p > 0));
  });
});
