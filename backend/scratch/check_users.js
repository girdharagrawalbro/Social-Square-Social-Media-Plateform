const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI;

// String replacement to append the database name 'socialsquare'
let targetUri = MONGO_URI;
if (targetUri.includes('/?')) {
  targetUri = targetUri.replace('/?', '/socialsquare?');
} else if (targetUri.includes('?')) {
  const parts = targetUri.split('?');
  if (!parts[0].endsWith('/')) {
    parts[0] += '/';
  }
  parts[0] += 'socialsquare';
  targetUri = parts.join('?');
} else {
  if (!targetUri.endsWith('/')) {
    targetUri += '/';
  }
  targetUri += 'socialsquare';
}

const UserSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', UserSchema);

async function check() {
  try {
    console.log('Connecting to:', targetUri);
    await mongoose.connect(targetUri);
    const users = await User.find({});
    console.log(`Found ${users.length} users in 'socialsquare' database:`);
    console.log(JSON.stringify(users, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await mongoose.disconnect();
  }
}

check();
