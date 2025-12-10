import { intervalToDuration } from "date-fns";
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDurationMs(ms: number) {
  const duration = intervalToDuration({ start: 0, end: ms });

  const { hours = 0, minutes = 0, seconds = 0 } = duration;

  const pad = (n: number) => n.toString().padStart(2, "0");

  if (hours > 0) {
    // Over 1 hour → HH:MM:SS
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  // Under 1 hour → MM:SS
  return `${pad(minutes)}:${pad(seconds)}`;
}
