// Usage: npm run reset-password -- <email or username> [new school email]
// Gives the account a one-time temporary password (printed once) and asks for a new one at next sign-in.
// Use it to get into an admin account when nobody knows its password. Existing sessions of that user are signed out.
// People sign in with their email, so an account without one needs the second argument, e.g.
//   npm run reset-password -- Organizer office@e-p-s.in
import mongoose from 'mongoose';
import { connectDb } from '../src/db.js';
import { User } from '../src/models/User.js';
import { hashPassword } from '../src/utils/password.js';
import { generateTempPassword } from '../src/utils/passwordPolicy.js';
import { schoolEmail } from '../src/utils/helpers.js';

const [who, newEmail] = process.argv.slice(2);
if (!who) {
  console.error('Usage: npm run reset-password -- <email or username> [new school email]');
  process.exit(1);
}

let email = null;
try { email = newEmail ? schoolEmail(newEmail) : null; } catch (e) { console.error(e.message); process.exit(1); }

await connectDb();
const user = await User.findOne(who.includes('@') ? { email: who.toLowerCase() } : { username: who });
let ok = false;
if (!user) {
  console.error(`No account with ${who.includes('@') ? 'email' : 'username'} "${who}".`);
} else if (email && await User.exists({ email, _id: { $ne: user._id } })) {
  console.error(`${email} already belongs to someone else.`);
} else if (!email && !user.email) {
  console.error(`${user.name} has no email, so they could not sign in. Add one: npm run reset-password -- ${who} name@e-p-s.in`);
} else {
  const temp = generateTempPassword();
  if (email) user.email = email;
  user.password = hashPassword(temp);
  user.mustChangePassword = true;
  user.passwordChangedAt = new Date();
  await user.save();
  ok = true;
  console.log(`${user.name} (${user.role}) signs in with ${user.email} and temporary password ${temp}   (shown once; a new password is asked for at sign-in)`);
}
await mongoose.disconnect();
process.exit(ok ? 0 : 1);
