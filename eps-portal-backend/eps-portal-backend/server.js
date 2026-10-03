import { config } from './src/config.js';
import { connectDb } from './src/db.js';
import { createApp } from './src/app.js';

await connectDb();
createApp().listen(config.port, () => console.log(`EPS Portal API listening on :${config.port}`));
