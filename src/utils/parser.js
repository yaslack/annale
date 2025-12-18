export const parseQCM = (text, config = {}) => {
  const {
    blockSeparator = '---',
    choiceSeparator = '???',
    answerSeparator = 'ANSWER:'
  } = config;

  if (!text) return [];

  const rawBlocks = text.split(blockSeparator).map(q => q.trim()).filter(q => q);

  return rawBlocks.map((block, index) => {
    let questionText = '';
    let choicesRaw = '';
    let answerRaw = '';

    // Check for Choice Separator
    if (block.includes(choiceSeparator)) {
      const parts = block.split(choiceSeparator);
      questionText = parts[0].trim();
      const rest = parts.slice(1).join(choiceSeparator).trim();

      // Check for Answer Separator in the rest
      if (rest.includes(answerSeparator)) {
        const answerParts = rest.split(answerSeparator);
        choicesRaw = answerParts[0].trim();
        answerRaw = answerParts.slice(1).join(answerSeparator).trim();
      } else {
        choicesRaw = rest;
      }
    } else {
      // Fallback to line-based if no choice separator
      const lines = block.split('\n').map(l => l.trim()).filter(l => l);
      if (lines.length > 0) {
        questionText = lines[0];
        const lastLine = lines[lines.length - 1];
        if (lastLine.toUpperCase().startsWith(answerSeparator.toUpperCase())) {
          answerRaw = lastLine.substring(answerSeparator.length).trim();
          choicesRaw = lines.slice(1, -1).join('\n');
        } else {
          choicesRaw = lines.slice(1).join('\n');
        }
      }
    }

    // Parse answers: split by space, comma, or just characters if no separators?
    // User example: "ANSWER: A B E" -> Space separated
    // Let's normalize: replace commas with spaces, trim, split by space
    const validAnswers = answerRaw
      ? answerRaw.replace(/,/g, ' ').split(/\s+/).map(a => a.trim().toUpperCase()).filter(a => a)
      : [];

    const options = choicesRaw.split('\n').map(l => l.trim()).filter(l => l).map(optText => {
      let isCorrect = false;

      if (validAnswers.length > 0) {
        // Check against all valid answers
        for (const ans of validAnswers) {
          // Exact match of full text
          if (optText.toUpperCase() === ans) {
            isCorrect = true;
            break;
          }
          // Letter match (e.g. Answer: A, Option: A) Paris or A. Paris)
          // We assume the option starts with the letter followed by ) or .
          if (optText.toUpperCase().startsWith(ans + ')') || optText.toUpperCase().startsWith(ans + '.')) {
            isCorrect = true;
            break;
          }
        }
      }

      return { text: optText, isCorrect };
    });

    return {
      id: Date.now() + index,
      text: questionText,
      options: options,
      image: null,
      type: 'multiple', // Always multiple to hide number of correct answers
      answerExplanation: answerRaw
    };
  }).filter(q => q.text);
};
