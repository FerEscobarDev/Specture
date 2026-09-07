'use strict';
const { normalizeTagName, isNearDuplicate } = require('./normalize');

const MAX_TAGS_PER_FILE = 10; // RN-005
const UNIQUE_VIOLATION = '23505';

class TagLimitError extends Error {
  constructor(fileId) {
    super(`file ${fileId} already has ${MAX_TAGS_PER_FILE} tags`);
    this.code = 'LIMITE_ETIQUETAS';
  }
}

class TagRepository {
  constructor(db) {
    this.db = db;
  }

  // Finds a tag by normalized name, reusing a near-duplicate if one exists;
  // otherwise inserts it. Retries the insert exactly once on a unique violation
  // (a concurrent insert of the same name won the race).
  findOrCreate(name, cb) {
    const normalized = normalizeTagName(name);
    this.db.query('SELECT id, name FROM tags', (err, rows) => {
      if (err) return cb(err);
      const twin = rows.find((r) => isNearDuplicate(r.name, normalized));
      if (twin) return cb(null, twin);
      const insert = (attempt) => {
        this.db.query('INSERT INTO tags(name) VALUES ($1) RETURNING id, name', [normalized], (e, inserted) => {
          if (e && e.code === UNIQUE_VIOLATION && attempt === 0) return insert(1);
          if (e) return cb(e);
          cb(null, inserted[0]);
        });
      };
      insert(0);
    });
  }

  // Attaches tagId to fileId enforcing MAX_TAGS_PER_FILE. The count and the insert
  // run inside one transaction so two concurrent attaches cannot exceed the cap;
  // on the 11th tag the transaction is rolled back and TagLimitError is returned.
  attach(fileId, tagId, cb) {
    this.db.query('BEGIN', (err) => {
      if (err) return cb(err);
      this.db.query('SELECT count(*)::int AS n FROM file_tags WHERE file_id = $1 FOR UPDATE', [fileId], (e1, rows) => {
        if (e1) return this.db.query('ROLLBACK', () => cb(e1));
        if (rows[0].n >= MAX_TAGS_PER_FILE) return this.db.query('ROLLBACK', () => cb(new TagLimitError(fileId)));
        this.db.query('INSERT INTO file_tags(file_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [fileId, tagId], (e2) => {
          if (e2) return this.db.query('ROLLBACK', () => cb(e2));
          this.db.query('COMMIT', (e3) => cb(e3 || null));
        });
      });
    });
  }
}

module.exports = { TagRepository, TagLimitError, MAX_TAGS_PER_FILE };
