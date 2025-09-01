
'use server';
/**
 * @fileOverview An AI flow to perform a liveness check on a user's snapshot.
 *
 * This flow uses a multimodal AI model to determine if a given photo is of a live person
 * or a photo of a digital screen, helping to prevent spoofing attacks.
 * 
 * - livenessCheck - A function that handles the liveness check process.
 * - LivenessCheckInput - The input type for the livenessCheck function.
 * - LivenessCheckOutput - The return type for the livenessCheck function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

export const LivenessCheckInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A snapshot photo of a person, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type LivenessCheckInput = z.infer<typeof LivenessCheckInputSchema>;

export const LivenessCheckOutputSchema = z.object({
  isLive: z
    .boolean()
    .describe(
      'Whether the image is determined to be of a live person and not a screen. True for a live person, false otherwise.'
    ),
  reason: z
    .string()
    .describe(
      'A brief, user-friendly reason for the determination. For example, "Moiré pattern detected" or "Image appears to be a digital screen."'
    ),
});
export type LivenessCheckOutput = z.infer<typeof LivenessCheckOutputSchema>;

export async function livenessCheck(input: LivenessCheckInput): Promise<LivenessCheckOutput> {
  return livenessCheckFlow(input);
}

const prompt = ai.definePrompt({
  name: 'livenessCheckPrompt',
  input: { schema: LivenessCheckInputSchema },
  output: { schema: LivenessCheckOutputSchema },
  prompt: `You are an expert security system designed to detect identity spoofing. Your task is to analyze the provided image to determine if it is a live person or a digital screen (like a phone or monitor).

Look for tell-tale signs of a screen being recorded:
1.  **Moiré Patterns:** Do you see wavy or circular interference lines? This is a strong indicator.
2.  **Unnatural Lighting:** Does the light seem to be emitted from the face itself, rather than reflected on it? Look for flat, uniform light characteristic of a display.
3.  **Screen Glare/Reflections:** Can you see reflections of the room on the surface of the image?
4.  **Bezels and Edges:** Are there unnatural straight lines or frames around the face that could be the edge of a phone or monitor?
5.  **Pixelation and Texture:** Does the texture look like skin, or does it have the characteristics of digital pixels?

Based on your analysis, determine if the person is live. Provide a clear "true" or "false" for the 'isLive' field and a brief, user-friendly explanation for your decision in the 'reason' field.`,
});

const livenessCheckFlow = ai.defineFlow(
  {
    name: 'livenessCheckFlow',
    inputSchema: LivenessCheckInputSchema,
    outputSchema: LivenessCheckOutputSchema,
  },
  async (input) => {
    const { output } = await prompt({
        photoDataUri: input.photoDataUri,
    });
    
    // Fallback in case the model returns a nullish response
    if (!output) {
      return {
        isLive: false,
        reason: "The AI model could not analyze the image. Please try again."
      };
    }

    return output;
  }
);
