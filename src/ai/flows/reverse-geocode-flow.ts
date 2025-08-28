/**
 * @fileOverview A flow to get a place name from coordinates.
 *
 * - reverseGeocode - A function that returns a place name from latitude and longitude.
 * - ReverseGeocodeInput - The input type for the reverseGeocode function.
 * - ReverseGeocodeOutput - The return type for the reverseGeocode function.
 */

'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';

export const ReverseGeocodeInputSchema = z.object({
  latitude: z.number().describe('The latitude of the location.'),
  longitude: z.number().describe('The longitude of the location.'),
});
export type ReverseGeocodeInput = z.infer<typeof ReverseGeocodeInputSchema>;

export const ReverseGeocodeOutputSchema = z.object({
  placeName: z
    .string()
    .describe(
      'A descriptive name for the location, like a street address or a well-known place.'
    ),
});
export type ReverseGeocodeOutput = z.infer<typeof ReverseGeocodeOutputSchema>;

const prompt = ai.definePrompt({
  name: 'reverseGeocodePrompt',
  input: { schema: ReverseGeocodeInputSchema },
  output: { schema: ReverseGeocodeOutputSchema },
  prompt: `Based on the provided latitude and longitude, what is the name of the place (e.g., street address, landmark)? 
  
  Latitude: {{{latitude}}}
  Longitude: {{{longitude}}}
  
  Provide only the place name.`,
});

const reverseGeocodeFlow = ai.defineFlow(
  {
    name: 'reverseGeocodeFlow',
    inputSchema: ReverseGeocodeInputSchema,
    outputSchema: ReverseGeocodeOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);

export async function reverseGeocode(
  input: ReverseGeocodeInput
): Promise<ReverseGeocodeOutput> {
  return reverseGeocodeFlow(input);
}
