const bcrypt = require("bcrypt");

(async () => {
  const password = "victor";
  const hash = await bcrypt.hash(password, 10);
  console.log(hash);
})();
