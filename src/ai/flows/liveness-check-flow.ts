
'use server';
/**
 * @fileOverview An AI flow to perform a liveness check on a user's photo.
 *
 * - checkLiveness - A function that verifies if a user performed a specific action in a photo.
 * - LivenessCheckInput - The input type for the checkLiveness function.
 * - LivenessCheckOutput - The return type for the checkLiveness function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const LivenessCheckInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo snapshot of a person, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  challenge: z.enum(['smile', 'blink']).describe('The liveness challenge the user was asked to perform.'),
});
export type LivenessCheckInput = z.infer<typeof LivenessCheckInputSchema>;

const LivenessCheckOutputSchema = z.object({
  isLive: z.boolean().describe('Whether or not the user seems to be live and has performed the requested action.'),
  reason: z.string().describe('A brief explanation for the decision, e.g., "User is smiling as requested." or "User did not blink."'),
});
export type LivenessCheckOutput = z.infer<typeof LivenessCheckOutputSchema>;

export async function checkLiveness(input: LivenessCheckInput): Promise<LivenessCheckOutput> {
  return livenessCheckFlow(input);
}

const prompt = ai.definePrompt({
  name: 'livenessCheckPrompt',
  input: { schema: LivenessCheckInputSchema },
  output: { schema: LivenessCheckOutputSchema },
  prompt: `You are an AI security expert specializing in liveness detection. Your task is to determine if the user in the provided photo is a live person who has successfully completed a specific challenge.

Analyze the photo and determine if the user has performed the following action: '{{challenge}}'.

- If the user is clearly performing the action (e.g., smiling when asked to smile, or has their eyes closed when asked to blink), set 'isLive' to true.
- If the user is not performing the action, or if the image is a picture of a screen, a static photo, or otherwise clearly not a live person, set 'isLive' to false.
- Provide a clear, concise reason for your decision in the 'reason' field.

User Photo: {{media url=photoDataUri}}`,
});

const livenessCheckFlow = ai.defineFlow(
  {
    name: 'livenessCheckFlow',
    inputSchema: LivenessCheckInputSchema,
    outputSchema: LivenessCheckOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
        throw new Error("The AI model did not return a valid response.");
    }
    return output;
  }
);
