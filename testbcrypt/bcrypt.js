import bcrypt from 'bcryptjs';

async function generateHash() {
  const plainPassword = 'admin123'; // Change this to your desired password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(plainPassword, salt);
  console.log('Plain password:', plainPassword);
  console.log('Hashed password:', hashedPassword);
}

generateHash();