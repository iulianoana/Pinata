export function validateQuizJson(data) {
  if (!data || typeof data !== "object") {
    return { valid: false, error: "Invalid JSON format" };
  }

  const questions = data.questions;
  if (!Array.isArray(questions) || questions.length === 0) {
    return { valid: false, error: "No questions found in this file" };
  }

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q.prompt && !q.question) {
      return { valid: false, error: `Question ${i + 1} is missing a prompt or question field` };
    }
  }

  return { valid: true, questionCount: questions.length };
}
