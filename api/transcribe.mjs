// Vercel function: reuses the app's Groq handler for /api/transcribe.
import { handleAPI } from '../voice-note/server/groq.mjs';

export const POST = request => handleAPI(request, process.env);
