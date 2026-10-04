import 'dotenv/config';

async function testPatch() {
  // 1. Login
  const loginRes = await fetch('http://localhost:5000/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: process.env.ADMIN_USERNAME,
      password: process.env.ADMIN_PASSWORD_HASH // wait, frontend sends the plaintext password, but process.env has the hash!
    })
  });
  console.log('Login Status:', loginRes.status);
}
testPatch();
