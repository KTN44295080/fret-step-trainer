export type GuitarString = 1 | 2 | 3 | 4 | 5 | 6;

export function frequencyFor(stringNo: GuitarString, fret: number, capo?: number): number;
export function originalSecondsPerStep(originalBpm: number): number;
export function videoTimeForPosition(videoStartSeconds: number, originalBpm: number, measure: number, step?: number): number;
export function playbackPositionSteps(positionSteps: number, scheduledAt: number, now: number, bpm: number): number;
export function positionToMeasure(startMeasure: number, endMeasure: number, positionSteps: number): number;
export function nearestPlaybackRate(requestedRate: number, availableRates: readonly number[]): number;
export function centsBetween(frequency: number, targetFrequency: number): number;
export function clamp(value: number, minimum: number, maximum: number): number;
