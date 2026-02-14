'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * MediaPipe Hand Tracking Adapter for 67 Royale
 *
 * This adapter wraps the BrainrotDetector (MediaPipe Hands) to provide
 * the same interface as the original HandTracker, allowing seamless
 * integration with existing components.
 */

import { BrainrotDetector, DetectionFrame } from './brainrot-detector';

// Re-export types for compatibility with existing code
export type NormalizedLandmark = { x: number; y: number; z?: number; visibility?: number };
export type NormalizedLandmarkList = NormalizedLandmark[];
export type BackendType = 'mediapipe';
export type InitState = 'idle' | 'loading' | 'warmup' | 'warming_up' | 'ready' | 'error';
export type WristState = 'GOOD' | 'WEAK' | 'LOST';

export interface WristSignal {
  x: number;
  y: number;
  score: number;
  state: WristState;
}

export type RepState = 'WAITING' | 'TRACKING';

export interface TrackingState {
  bothHandsDetected: boolean;
  leftY: number | null;
  rightY: number | null;
  leftSignal: WristSignal | null;
  rightSignal: WristSignal | null;
  repState: RepState;
  repCount: number;
  isCalibrated: boolean;
  calibrationProgress: number;
  trackingLost: boolean;
  backendWarning?: string;
  initState?: InitState;
}

/**
 * CalibrationTracker - Maps BrainrotDetector's calibration to HandTracker interface
 */
export class CalibrationTracker {
  private _isCalibrated = false;
  private trackerRef: HandTracker | null = null;

  reset(): void {
    this._isCalibrated = false;
  }

  getProgress(): number {
    return this._isCalibrated ? 1 : 0;
  }

  isCalibrated(): boolean {
    return this._isCalibrated;
  }

  setCalibrated(calibrated: boolean): void {
    this._isCalibrated = calibrated;
  }

  setTracker(tracker: HandTracker): void {
    this.trackerRef = tracker;
  }

  processFrame(bothHandsDetected: boolean): boolean {
    // Delegate to HandTracker's processCalibration
    if (this.trackerRef) {
      const calibrated = this.trackerRef.processCalibration(bothHandsDetected);
      if (calibrated) {
        this._isCalibrated = true;
      }
      return calibrated;
    }
    return this._isCalibrated;
  }
}

/**
 * RepCounter - Dummy class for compatibility
 * (BrainrotDetector handles rep counting internally)
 */
export class RepCounter {
  private repCount = 0;

  reset(): void {
    this.repCount = 0;
  }

  getRepCount(): number {
    return this.repCount;
  }

  getState(): RepState {
    return 'WAITING';
  }

  processSignals(_leftSignal?: any, _rightSignal?: any, _timestamp?: number): boolean {
    return false;
  }

  processWrists(_leftWristY?: number | null, _rightWristY?: number | null): boolean {
    return false;
  }

  processFrame(_leftLandmarks?: any, _rightLandmarks?: any): boolean {
    return false;
  }
}

/**
 * HandTracker - MediaPipe adapter
 *
 * Wraps BrainrotDetector to provide the same interface as the MoveNet-based HandTracker
 */
export class HandTracker {
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private stream: MediaStream | null = null;
  private detector: BrainrotDetector | null = null;
  private onResultsCallback: ((state: TrackingState) => void) | null = null;
  private currentInitState: InitState = 'idle';
  private isCalibrated = false;
  private currentFrame: DetectionFrame | null = null;

  /** Expose the camera MediaStream so it can be shared (e.g. with WebRTC). */
  public getStream(): MediaStream | null {
    return this.stream;
  }

  /**
   * Initialize the tracker with MediaPipe Hands
   */
  async initialize(
    videoElement: HTMLVideoElement,
    canvasElement: HTMLCanvasElement,
    onResults: (state: TrackingState) => void
  ): Promise<void> {
    this.videoElement = videoElement;
    this.canvasElement = canvasElement;
    this.onResultsCallback = onResults;

    // Send initial loading state
    this.currentInitState = 'loading';
    this.sendState();

    // Get camera stream
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 640 },
        height: { ideal: 640 },
        frameRate: { ideal: 60, min: 30 }
      }
    });

    videoElement.srcObject = this.stream;
    await videoElement.play();

    // Initialize BrainrotDetector
    this.detector = new BrainrotDetector(videoElement, canvasElement);

    // Set up callbacks
    this.detector.onFrame = (frame: DetectionFrame) => {
      this.currentFrame = frame;
      this.sendState();
    };

    this.detector.onCalibrationComplete = () => {
      this.isCalibrated = true;
      console.log('✅ MediaPipe calibration complete');
    };

    // Start detector
    this.currentInitState = 'warmup';
    this.sendState();

    await this.detector.start();

    // Mark as ready
    this.currentInitState = 'ready';
    this.sendState();
  }

  private sendState(): void {
    if (!this.onResultsCallback) return;

    const frame = this.currentFrame;
    const repCount = frame?.count ?? 0;
    const bothHandsDetected = frame?.bothHandsVisible ?? false;

    // Convert DetectionFrame to TrackingState
    const state: TrackingState = {
      bothHandsDetected,
      leftY: null, // BrainrotDetector doesn't expose raw Y values
      rightY: null,
      leftSignal: null,
      rightSignal: null,
      repState: frame?.phase === 'active' ? 'TRACKING' : 'WAITING',
      repCount,
      isCalibrated: this.isCalibrated || frame?.phase === 'active',
      calibrationProgress: frame?.calibrationProgress ?? 0,
      trackingLost: !bothHandsDetected,
      initState: this.currentInitState,
    };

    this.onResultsCallback(state);
  }

  start(): void {
    // Camera already started in initialize()
    console.log('HandTracker.start() - detector already running');
  }

  stop(): void {
    this.detector?.stop();
  }

  processCalibration(bothHandsDetected: boolean): boolean {
    // Start calibration automatically when called
    if (this.detector) {
      const phase = this.detector.getPhase();

      // Auto-start calibration if idle
      if (phase === 'idle') {
        console.log('🎯 Auto-starting calibration...');
        this.detector.startCalibration();
      }

      // Check if calibration is complete
      if (phase === 'active') {
        this.isCalibrated = true;
        return true;
      }
    }

    return this.isCalibrated;
  }

  processGameplay(
    _leftLandmarks: NormalizedLandmarkList | null,
    _rightLandmarks: NormalizedLandmarkList | null
  ): boolean {
    // Gameplay processing is handled automatically by BrainrotDetector
    // Just return whether a rep was counted
    const previousCount = this.currentFrame?.count ?? 0;
    const currentCount = this.detector?.getCount() ?? 0;
    return currentCount > previousCount;
  }

  resetCalibration(): void {
    this.isCalibrated = false;
    // No need to reset detector - it will recalibrate on next game
  }

  resetRepCounter(): void {
    // Reset only the count, not the entire detector state or phase
    if (this.detector) {
      this.detector.resetCount();

      // Ensure detector is in active phase for gameplay
      const phase = this.detector.getPhase();
      if (phase !== 'active') {
        // Transition to active if calibration was completed
        if (this.isCalibrated || phase === 'calibrating') {
          (this.detector as any).state.phase = 'active';
        }
      }
    }
  }

  getRepCount(): number {
    return this.detector?.getCount() ?? 0;
  }

  getLastResults(): any {
    return null;
  }

  getBackendType(): BackendType {
    return 'mediapipe';
  }

  async cleanup(): Promise<void> {
    this.stop();

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    this.videoElement = null;
    this.canvasElement = null;
    this.detector = null;
    this.currentInitState = 'idle';
    this.isCalibrated = false;
  }
}

// Export for backwards compatibility
export { HandTracker as default };
