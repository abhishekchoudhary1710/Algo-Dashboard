// Usage: node scripts/set-password.js <new-password>
// Copy the output hash into .env.local as AUTH_PASSWORD_HASH

const bcrypt = require("bcryptjs");
const password = process.argv[2];

if (!password) {
  console.error("Usage: node scripts/set-password.js <new-password>");
  process.exit(1);
}

bcrypt.hash(password, 10).then((hash) => {
  console.log(`\nSet this in your .env.local:\nAUTH_PASSWORD_HASH=${hash}\n`);
});
