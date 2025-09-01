/**
 * @fileoverview This file initializes the Genkit AI platform with the necessary plugins.
 * It is used by all flows in the application.
 */
'use server';

import {genkit} from '@genkit-ai/core';
import {googleAI} from '@genkit-ai/googleai';
import {defineSecret} from 'genkit/secrets';

defineSecret('GEMINI_API_KEY', 'Google AI Gemini API Key');

export const ai = genkit({
  plugins: [
    googleAI({
      apiVersion: ['v1beta'],
    }),
  ],
  logSinks: [],
  enableTracing: false,
});
