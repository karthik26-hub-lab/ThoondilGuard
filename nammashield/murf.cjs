const fs = require('fs');
const https = require('https');

const API_KEY = 'ap2_82c00f29-acc4-4583-8b27-81079fa7974f';
const BASE_URL = 'https://api.murf.ai/v1';

async function generateSpeech(text, voiceId, filename) {
  console.log(`Generating ${filename}...`);
  const response = await fetch(`${BASE_URL}/speech/generate`, {
    method: 'POST',
    headers: {
      'api-key': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: text,
      voiceId: voiceId,
      style: 'Conversational',
      rate: 0,
      format: 'MP3'
    })
  });
  
  if (!response.ok) {
    throw new Error(`Speech generation failed for ${filename}: HTTP ${response.status}`);
  }
  
  const data = await response.json();
  console.log(`Generated ${filename}`);
  
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(`public/${filename}`);
    https.get(data.audioFile, (res) => {
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`Saved public/${filename}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(`public/${filename}`, () => {});
      reject(err);
    });
  });
}

async function main() {
  // Added ellipses for natural pausing
  const enText = "Got a message that doesn't feel right? Paste it here, or add a screenshot. We'll show you the warning signs, like pressure to pay quickly or a link that needs checking. Then you'll get a practical next step, such as checking your bill through the official service.";
  
  // Added ellipses and commas for Tamil pausing
  const taText = "ஒரு மெசேஜ் வந்திருக்கு. உண்மையா இல்லையான்னு சந்தேகமா? அதை இங்கே பேஸ்ட் பண்ணுங்க, இல்ல ஸ்கிரீன்ஷாட் சேர்க்கலாம். உடனே பணம் கட்டச் சொல்றதா, லிங்க் சரிபார்க்க வேண்டியிருக்கா, இப்படிப்பட்ட அறிகுறிகளைக் காட்டுவோம். அடுத்து என்ன செய்யலாம்னும் சொல்வோம். உதாரணத்துக்கு, அதிகாரப்பூர்வ சேவையை நீங்களே திறந்து உங்கள் பில்லைச் சரிபார்க்கலாம்.";

  await generateSpeech(enText, "en-IN-isha", "demo-en-v3.mp3");
  await generateSpeech(taText, "ta-IN-iniya", "demo-ta-v3.mp3");
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
