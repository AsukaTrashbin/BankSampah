'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

class DataFileError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'DataFileError';
    this.code = 'DATA_FILE_CORRUPT';
    if (cause) {
      this.cause = cause;
    }
  }
}

function validateUserShape(users) {
  if (!Array.isArray(users)) {
    throw new DataFileError('File data user harus berupa array JSON.');
  }

  const valid = users.every((user) => (
    user &&
    typeof user === 'object' &&
    typeof user.id === 'string' &&
    user.id.length > 0 &&
    typeof user.name === 'string' &&
    typeof user.email === 'string' &&
    typeof user.passwordHash === 'string' &&
    typeof user.createdAt === 'string'
  ));

  if (!valid) {
    throw new DataFileError('File data user berisi entri yang tidak valid.');
  }
}

function createUserStore(filePath) {
  const targetFile = path.resolve(filePath);
  let queue = Promise.resolve();
  let initialized = false;

  function enqueue(task) {
    const run = queue.then(task, task);
    queue = run.then(() => undefined, () => undefined);
    return run;
  }

  async function readFile() {
    let raw;
    try {
      raw = await fs.promises.readFile(targetFile, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }

    if (!raw.trim()) {
      throw new DataFileError('File data user kosong atau tidak dapat dibaca.');
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new DataFileError('File data user bukan JSON yang valid. File tidak ditimpa.', error);
    }

    validateUserShape(parsed);
    return parsed;
  }

  async function writeAtomic(users) {
    const directory = path.dirname(targetFile);
    const tempFile = `${targetFile}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    const payload = `${JSON.stringify(users, null, 2)}\n`;

    await fs.promises.mkdir(directory, { recursive: true });

    let handle;
    try {
      handle = await fs.promises.open(tempFile, 'w', 0o600);
      await handle.writeFile(payload, 'utf8');
      await handle.sync();
      await handle.close();
      handle = null;
      await fs.promises.rename(tempFile, targetFile);
    } catch (error) {
      if (handle) {
        await handle.close().catch(() => undefined);
      }
      await fs.promises.unlink(tempFile).catch(() => undefined);
      throw error;
    }
  }

  async function ensureFile() {
    if (initialized) {
      return;
    }

    await fs.promises.mkdir(path.dirname(targetFile), { recursive: true });

    try {
      await fs.promises.access(targetFile);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      await writeAtomic([]);
    }

    // Fail fast on a corrupt file instead of silently replacing it.
    await readFile();
    initialized = true;
  }

  return {
    filePath: targetFile,
    init: () => enqueue(ensureFile),

    readAll() {
      return enqueue(async () => {
        await ensureFile();
        return readFile();
      });
    },

    findById(id) {
      return enqueue(async () => {
        await ensureFile();
        const users = await readFile();
        return users.find((user) => user.id === id) || null;
      });
    },

    findByEmail(email) {
      return enqueue(async () => {
        await ensureFile();
        const users = await readFile();
        return users.find((user) => user.email === email) || null;
      });
    },

    /**
     * The mutator runs inside the single write queue so read-modify-write
     * operations (duplicate checks, counters, resets) cannot race.
     */
    update(mutator) {
      return enqueue(async () => {
        await ensureFile();
        const users = await readFile();
        const draft = users.map((user) => ({ ...user }));
        const result = await mutator(draft);
        validateUserShape(draft);
        await writeAtomic(draft);
        return result;
      });
    }
  };
}

module.exports = { createUserStore, DataFileError };
