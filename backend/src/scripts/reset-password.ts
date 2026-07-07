import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { sequelize, User } from "../models";

dotenv.config();

async function resetPassword() {
  await sequelize.authenticate();
  const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

  const user = await User.findOne({ where: { email: adminEmail } });
  if (!user) {
    console.log("Admin user not found");
    process.exit(1);
  }

  await user.update({ password: bcrypt.hashSync(adminPassword, 10) });
  console.log(`Password updated for ${user.username} (${user.email})`);
  await sequelize.close();
}

resetPassword().catch((err) => {
  console.error(err);
  process.exit(1);
});
