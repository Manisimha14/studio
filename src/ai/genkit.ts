
/**
 * @fileoverview This file initializes and a new Genkit instance.
 * It is used by all flows in the application.
 */
import { genkit, type GenkitError } from '@genkit-ai/core';
import { googleAI, type GoogleAIGeminiError } from '@genkit-ai/googleai';
import { firebase } from '@genkit-ai/firebase';

// Initialize Genkit with the Google AI plugin
export const ai = genkit({
  plugins: [
    firebase(),
    googleAI({
      apiVersion: 'v1beta',
      // Provide a function to get the Gemini API key from Firebase Auth user's custom claims.
      // The `auth` object is passed in by the Firebase plugin.
      // See https://firebase.google.com/docs/auth/admin/custom-claims
      async apiKey(auth) {
        if (!auth) {
          throw new Error(
            'Request not authenticated. Must be logged in to call this flow.'
          );
        }
        const user = await auth.verifyIdToken();
        if (user?.gemini_api_key) {
          return user.gemini_api_key as string;
        }
        throw new Error(
          'GEMINI_API_KEY custom claim not found. ' +
            'Did you set it on the user?. ' +
            'See https://firebase.google.com/docs/auth/admin/custom-claims'
        );
      },
    }),
  ],
  // We are not logging traces to the GCP Trace service.
  // We are using the Firebase plugin's trace store, which will log traces to
  // either Firestore or RTDB, depending on how the plugin is configured.
  // See https://genkit.dev/docs/plugins/firebase#tracing
  traceStore: 'firebase',
  // In a production environment, you would want to throw errors.
  // For this sample, we are logging them to the console.
  // In a development environment, you can set this to `true` to
  // see the full error stack trace.
  devErrorCallback: (err: GenkitError | GoogleAIGeminiError) => {
    if ('isGoogleAIGeminiError' in err) {
      console.error(
        `[GoogleAI Error] ${err.message}`,
        err.reason,
        err.info,
        err.curl
      );
    } else {
      console.error(`[Genkit Error] ${err.message}`, err.stack);
    }
  },
});
