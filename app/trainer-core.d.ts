export type GuitarString = 1 | 2 | 3 | 4 | 5 | 6;

export function frequencyFor(stringNo: GuitarString, fret: number, capo?: number): number;
export function originalSecondsPerStep(originalBpm: number): number;
export type MeterMap = Record<number, number>;
export function beatsForMeasure(measure: number, meterMap?: MeterMap): number;
export function stepsForMeasure(measure: number, meterMap?: MeterMap): number;
export function stepsBeforeMeasure(measure: number, meterMap?: MeterMap): number;
export function stepsInRange(startMeasure: number, endMeasure: number, meterMap?: MeterMap): number;
export function measurePosition(startMeasure: number, endMeasure: number, positionSteps: number, meterMap?: MeterMap): { measure: number; step: number };
export function videoTimeForPosition(videoStartSeconds: number, originalBpm: number, measure: number, step?: number, meterMap?: MeterMap): number;
export function playbackPositionSteps(positionSteps: number, scheduledAt: number, now: number, bpm: number): number;
export function positionToMeasure(startMeasure: number, endMeasure: number, positionSteps: number, meterMap?: MeterMap): number;
export function nearestPlaybackRate(requestedRate: number, availableRates: readonly number[]): number;
export function centsBetween(frequency: number, targetFrequency: number): number;
export function clamp(value: number, minimum: number, maximum: number): number;
