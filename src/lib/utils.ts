import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function playSound(sound: 'click' | 'success' | 'error' | 'delete' | 'capture') {
    const audio = document.getElementById(`sound-${sound}`) as HTMLAudioElement | null;
    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(e => console.error(`Could not play sound: ${sound}`, e));
    }
}
