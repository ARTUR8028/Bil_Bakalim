import { Pool } from 'pg';
import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const questionsFilePath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../data/questions.json');

function decodeQuestionsBuffer(buffer) {
  if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
    return buffer.toString('utf16le');
  }
  if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
    return new TextDecoder('utf-16be').decode(buffer);
  }
  if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return buffer.slice(3).toString('utf8');
  }
  return buffer.toString('utf8');
}

export async function readQuestionsFromFile(filePath = questionsFilePath) {
  const buffer = await fs.readFile(filePath);
  return JSON.parse(decodeQuestionsBuffer(buffer));
}

export async function writeQuestionsToFile(questionList, filePath = questionsFilePath) {
  await fs.writeFile(filePath, JSON.stringify(questionList, null, 2) + '\n', { encoding: 'utf8' });
}

// PostgreSQL bağlantısı
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Veritabanı tablolarını oluştur
export async function initializeDatabase() {
  try {
    // Questions tablosunu oluştur
    await pool.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(question)
      )
    `);

    console.log('✅ Veritabanı tabloları hazır!');

    // Eğer tablo boşsa, questions.json'dan yükle
    const { rows } = await pool.query('SELECT COUNT(*) FROM questions');
    const count = parseInt(rows[0].count);

    if (count === 0) {
      console.log('📥 questions.json\'dan sorular yükleniyor...');
      try {
        const questions = await readQuestionsFromFile();
        
        for (const q of questions) {
          await pool.query(
            'INSERT INTO questions (question, answer) VALUES ($1, $2) ON CONFLICT (question) DO NOTHING',
            [q.question, q.answer]
          );
        }
        
        console.log(`✅ ${questions.length} soru veritabanına yüklendi!`);
      } catch (error) {
        console.error('⚠️ questions.json yüklenemedi:', error.message);
      }
    }

    return true;
  } catch (error) {
    console.error('❌ Veritabanı başlatma hatası:', error);
    throw error;
  }
}

// Tüm soruları getir
export async function getAllQuestions() {
  try {
    const { rows } = await pool.query('SELECT question, answer FROM questions ORDER BY id');
    return rows;
  } catch (error) {
    console.error('❌ Sorular getirilemedi:', error);
    return [];
  }
}

// Yeni soru ekle
export async function addQuestion(question, answer) {
  try {
    const result = await pool.query(
      'INSERT INTO questions (question, answer) VALUES ($1, $2) ON CONFLICT (question) DO NOTHING RETURNING *',
      [question, answer]
    );
    
    if (result.rowCount === 0) {
      throw new Error('Bu soru zaten mevcut!');
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('❌ Soru eklenemedi:', error);
    throw error;
  }
}

// Soruları toplu ekle (Excel upload için)
export async function addQuestionsInBulk(questionList) {
  try {
    let added = 0;
    let duplicates = 0;
    
    for (const q of questionList) {
      try {
        await pool.query(
          'INSERT INTO questions (question, answer) VALUES ($1, $2) ON CONFLICT (question) DO NOTHING',
          [q.question, q.answer]
        );
        added++;
      } catch (err) {
        duplicates++;
        console.warn(`⚠️ Mükerrer soru atlandı: ${q.question.substring(0, 50)}`);
      }
    }
    
    return { added, duplicates };
  } catch (error) {
    console.error('❌ Toplu ekleme hatası:', error);
    throw error;
  }
}

// Soru sayısını getir
export async function getQuestionCount() {
  try {
    const { rows } = await pool.query('SELECT COUNT(*) FROM questions');
    return parseInt(rows[0].count);
  } catch (error) {
    console.error('❌ Soru sayısı alınamadı:', error);
    return 0;
  }
}

// Tüm soruları sil
export async function deleteAllQuestions() {
  try {
    const result = await pool.query('DELETE FROM questions');
    console.log(`✅ ${result.rowCount} soru veritabanından silindi!`);
    return result.rowCount;
  } catch (error) {
    console.error('❌ Sorular silinemedi:', error);
    throw error;
  }
}

export default pool;

