import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const SAMPLE_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const valuesDir = resolve('android', 'app', 'src', 'main', 'res', 'values');
const targetFile = resolve(valuesDir, 'admob.xml');

mkdirSync(dirname(targetFile), { recursive: true });

const appId = (process.env.VITE_ADMOB_ANDROID_APP_ID || SAMPLE_APP_ID).trim();
const xml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="admob_app_id">${appId}</string>
</resources>
`;

writeFileSync(targetFile, xml, 'utf8');
