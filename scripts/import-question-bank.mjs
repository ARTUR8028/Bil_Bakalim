import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import xlsx from 'xlsx';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = process.argv[2];
const outputPath = path.join(projectRoot, 'data', 'questions.json');

if (!sourcePath) {
  throw new Error('Kullanım: node scripts/import-question-bank.mjs <excel-dosyası>');
}

const workbook = xlsx.readFile(sourcePath, { raw: false });
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(worksheet, {
  header: 1,
  defval: '',
  raw: false,
});
const seenQuestions = new Set();
const questions = [];

for (const row of rows.slice(1)) {
  const question = String(row[1] ?? '').trim();
  const answer = String(row[2] ?? '').trim();
  const questionKey = question.toLocaleLowerCase('tr-TR');

  if (!question || !answer || seenQuestions.has(questionKey)) {
    continue;
  }

  seenQuestions.add(questionKey);
  questions.push({ question, answer });
}

if (questions.length === 0) {
  throw new Error('B ve C sütunlarında geçerli soru-cevap kaydı bulunamadı.');
}

await fs.writeFile(outputPath, `${JSON.stringify(questions, null, 2)}\n`, 'utf8');
console.log(`${questions.length} soru ${outputPath} dosyasına yazıldı.`);
