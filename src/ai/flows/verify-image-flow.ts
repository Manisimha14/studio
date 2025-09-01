/**
 * @fileoverview A Genkit flow for verifying the authenticity of a student's photo.
 *
 * This flow uses a multimodal AI model to check if an image is a genuine snapshot
 * or a picture of another screen, and whether it contains reflections.
 */
'use server';

import {ai} from '@/ai/genkit';
import {z} from 'zod';

export const VerifyImageInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a student, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type VerifyImageInput = z.infer<typeof VerifyImageInputSchema>;

export const VerifyImageOutputSchema = z.object({
  isAuthentic: z.boolean().describe(
    'True if the image is a direct, authentic photo of a person. False if it appears to be a photo of another screen, device, or picture.'
  ),
  hasReflections: z.boolean().describe(
    'True if there are significant screen reflections, glare, or other light artifacts on the image. False otherwise.'
  ),
  reason: z.string().describe(
    'A brief, one-sentence explanation for the isAuthentic and hasReflections verdict. For example, "The image is clear and appears to be a direct photo." or "The presence of a digital screen border and moiré patterns suggest it is a photo of another device."'
  ),
});
export type VerifyImageOutput = z.infer<typeof VerifyImageOutputSchema>;

const verificationPrompt = ai.definePrompt({
  name: 'verifyImagePrompt',
  input: {schema: VerifyImageInputSchema},
  output: {schema: VerifyImageOutputSchema},
  prompt: `You are an AI assistant specializing in image fraud detection. Your task is to analyze the provided image to determine its authenticity for an attendance system.

  Evaluate the image based on the following criteria:
  1.  **Authenticity**: Is this a genuine, real-time photo of a person, or is it a photo of another photo, a screen, or a digital device? Look for signs like screen bezels, moiré patterns, pixelation, unnatural lighting, or reflections that indicate it's a "replay attack".
  2.  **Reflections**: Does the image contain any significant glare or reflections, especially those that might obscure the person's face (e.g., from glasses, windows, or screens)?

  Based on your analysis, provide a structured JSON output.

  Image to analyze: {{media url=photoDataUri}}`,
});

const verifyImageFlow = ai.defineFlow(
  {
    name: 'verifyImageFlow',
    inputSchema: VerifyImageInputSchema,
    outputSchema: VerifyImageOutputSchema,
  },
  async (input) => {
    const {output} = await verificationPrompt(input);
    if (!output) {
      throw new Error('The AI model did not return a valid response.');
    }
    return output;
  }
);


export async function verifyImage(input: VerifyImageInput): Promise<VerifyImageOutput> {
    return verifyImageFlow(input);
}
