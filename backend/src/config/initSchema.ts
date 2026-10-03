import { Pool } from 'pg';

export async function ensureDatabaseSchema(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        uid TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL,
        password_hash TEXT,
        display_name TEXT,
        photo_url TEXT,
        university TEXT,
        major TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS subjects (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
        name TEXT NOT NULL,
        code TEXT,
        color TEXT DEFAULT '#6366f1',
        description TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS study_materials (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
        subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_size INTEGER DEFAULT 0,
        raw_text TEXT NOT NULL,
        original_file_name TEXT,
        stored_path TEXT,
        page_count INTEGER DEFAULT 1,
        summary TEXT,
        key_concepts JSONB DEFAULT '[]',
        status TEXT DEFAULT 'processed',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS material_chunks (
        id SERIAL PRIMARY KEY,
        material_id INTEGER NOT NULL REFERENCES study_materials(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        token_count INTEGER DEFAULT 0,
        page_number INTEGER DEFAULT 1,
        embedding JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS quizzes (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
        subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        material_id INTEGER REFERENCES study_materials(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        difficulty TEXT DEFAULT 'medium',
        total_questions INTEGER NOT NULL DEFAULT 5,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,
        quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
        question_text TEXT NOT NULL,
        topic_tag TEXT NOT NULL,
        options JSONB NOT NULL,
        correct_option_index INTEGER NOT NULL,
        explanation TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS quiz_attempts (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
        quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
        score NUMERIC(5, 2) NOT NULL,
        total_answered INTEGER NOT NULL,
        correct_answers INTEGER NOT NULL,
        user_answers JSONB NOT NULL,
        time_taken_seconds INTEGER DEFAULT 0,
        completed_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS flashcards (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
        subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        material_id INTEGER REFERENCES study_materials(id) ON DELETE SET NULL,
        front_text TEXT NOT NULL,
        back_text TEXT NOT NULL,
        topic_tag TEXT DEFAULT 'General',
        difficulty_level TEXT DEFAULT 'medium',
        status TEXT DEFAULT 'new',
        review_count INTEGER DEFAULT 0,
        correct_count INTEGER DEFAULT 0,
        incorrect_count INTEGER DEFAULT 0,
        repetition_box INTEGER DEFAULT 1,
        last_reviewed_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS topic_progress (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
        subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        topic_name TEXT NOT NULL,
        total_questions_attempted INTEGER NOT NULL DEFAULT 0,
        total_correct INTEGER NOT NULL DEFAULT 0,
        mastery_status TEXT NOT NULL DEFAULT 'needs_focus',
        last_practiced_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS study_sessions (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
        subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
        activity_type TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL,
        started_at TIMESTAMP NOT NULL DEFAULT NOW(),
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS study_plans (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
        subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        target_date TEXT,
        daily_goals JSONB NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
        subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
        material_id INTEGER REFERENCES study_materials(id) ON DELETE SET NULL,
        mode TEXT DEFAULT 'auto',
        title TEXT NOT NULL DEFAULT 'New Study Conversation',
        last_message_snippet TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS conversation_messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        mode TEXT DEFAULT 'auto',
        resolved_mode TEXT,
        citations JSONB DEFAULT '[]',
        is_grounded_in_material BOOLEAN DEFAULT FALSE,
        confidence TEXT DEFAULT 'grounded',
        suggested_follow_ups JSONB DEFAULT '[]',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Ensure all optional / newer columns exist
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS university TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS major TEXT;

      ALTER TABLE study_materials ADD COLUMN IF NOT EXISTS original_file_name TEXT;
      ALTER TABLE study_materials ADD COLUMN IF NOT EXISTS stored_path TEXT;
      ALTER TABLE study_materials ADD COLUMN IF NOT EXISTS page_count INTEGER DEFAULT 1;

      ALTER TABLE material_chunks ADD COLUMN IF NOT EXISTS page_number INTEGER DEFAULT 1;
      ALTER TABLE material_chunks ADD COLUMN IF NOT EXISTS token_count INTEGER DEFAULT 0;
      ALTER TABLE material_chunks ADD COLUMN IF NOT EXISTS embedding JSONB;

      ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new';
      ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;
      ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS correct_count INTEGER DEFAULT 0;
      ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS incorrect_count INTEGER DEFAULT 0;
      ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

      ALTER TABLE conversations ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'auto';
      ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'auto';
      ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS resolved_mode TEXT;
    `);
  } finally {
    client.release();
  }
}
