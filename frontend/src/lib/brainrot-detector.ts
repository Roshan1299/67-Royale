'use client';

/**
 * BrainrotDetector - MediaPipe Hands-based 67 motion detector
 *
 * This is the superior CV model for detecting the 67 hand alternation motion.
 * Uses MediaPipe Hands for precise hand landmark tracking.
 *
 * Note: This file must be used client-side only due to MediaPipe dependencies
 */

// Type definitions for MediaPipe
export type NormalizedLandmark = {
  x: number;
  y: number;
  z: number;
  visibility?: number;
};

export type Results = {
  image: HTMLCanvasElement | HTMLVideoElement;
  multiHandLandmarks?: NormalizedLandmark[][];
  multiHandedness?: Array<{ label: string; score: number }>;
};

// MediaPipe instances will be loaded dynamically (client-side only)
let Hands: any = null;
let HAND_CONNECTIONS: any = null;
let drawConnectors: any = null;
let drawLandmarks: any = null;

// Landmark indices
const WRIST = 0;
const MIDDLE_MCP = 9;

// ============ TUNABLE PARAMETERS ============
export interface BrainrotConfig {
  // Detection thresholds
  minYDifference: number;      // Min vertical separation between hands (normalized 0-1)
  minVelocity: number;         // Min velocity to count as moving (per frame)

  // Smoothing
  smoothingFactor: number;     // Exponential smoothing (0 = no smoothing, 1 = max smoothing)

  // Anti-cheat
  requireOppositeMotion: boolean;

  // History for velocity calculation
  velocityWindow: number;      // Frames to calculate velocity over

  // MediaPipe confidence
  minDetectionConfidence: number;
  minTrackingConfidence: number;

  // Calibration
  calibrationDuration: number; // Calibration time in ms
  calibrationTolerance: number; // Max Y difference allowed during calibration
}

export const DEFAULT_CONFIG: BrainrotConfig = {
  minYDifference: 0.06,
  minVelocity: 0.008,
  smoothingFactor: 0.4,
  requireOppositeMotion: true,
  velocityWindow: 3,
  minDetectionConfidence: 0.75,
  minTrackingConfidence: 0.6,
  calibrationDuration: 3000,
  calibrationTolerance: 0.05,
};

type DetectorPhase = "idle" | "calibrating" | "active";

interface CalibrationData {
  baselineY: number;           // Average Y position of both hands at rest
  leftSamples: number[];
  rightSamples: number[];
  startTime: number;
}

interface DetectorState {
  // Current phase
  phase: DetectorPhase;

  // Calibration
  calibration: CalibrationData | null;

  // Smoothed positions
  leftY: number | null;
  rightY: number | null;

  // Position history for velocity
  leftHistory: number[];
  rightHistory: number[];

  // Last recorded alternation state
  lastAlternationState: "left-up" | "right-up" | null;

  // Score
  count: number;

  // Status flags
  isCurrentlyAlternating: boolean;
  bothHandsVisible: boolean;

  // Debug info
  leftVelocity: number;
  rightVelocity: number;
}

export type AlternationState = "left-up" | "right-up" | null;

export interface DetectionFrame {
  phase: DetectorPhase;
  count: number;
  isAlternating: boolean;
  bothHandsVisible: boolean;
  leftVelocity: number;
  rightVelocity: number;
  alternationState: AlternationState;
  calibrationProgress: number; // 0-1, only during calibration
  baselineY: number | null;
}

export class BrainrotDetector {
  private hands: any = null;
  private animationFrameId: number | null = null;
  private state: DetectorState;
  private config: BrainrotConfig;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private video: HTMLVideoElement;
  private isRunning = false;

  // Callbacks
  public onCount: ((count: number) => void) | null = null;
  public onFrame: ((frame: DetectionFrame) => void) | null = null;
  public onCalibrationComplete: ((baselineY: number) => void) | null = null;
  public onCalibrationFailed: ((reason: string) => void) | null = null;

  constructor(
    videoElement: HTMLVideoElement,
    canvasElement: HTMLCanvasElement,
    config: Partial<BrainrotConfig> = {}
  ) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext("2d")!;
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.state = this.createInitialState();
  }

  private async loadMediaPipe(): Promise<void> {
    if (Hands) return; // Already loaded
    if (typeof window === 'undefined') return; // Skip during SSR

    // Dynamic import for client-side only
    const handsModule = await import("@mediapipe/hands");
    const drawingModule = await import("@mediapipe/drawing_utils");

    Hands = handsModule.Hands;
    HAND_CONNECTIONS = handsModule.HAND_CONNECTIONS;
    drawConnectors = drawingModule.drawConnectors;
    drawLandmarks = drawingModule.drawLandmarks;
  }

  private async initializeHands(): Promise<void> {
    await this.loadMediaPipe();

    this.hands = new Hands({
      locateFile: (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      },
    });

    this.hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: this.config.minDetectionConfidence,
      minTrackingConfidence: this.config.minTrackingConfidence,
    });

    this.hands.onResults((results: Results) => this.onResults(results));
  }

  private createInitialState(): DetectorState {
    return {
      phase: "idle",
      calibration: null,
      leftY: null,
      rightY: null,
      leftHistory: [],
      rightHistory: [],
      lastAlternationState: null,
      count: 0,
      isCurrentlyAlternating: false,
      bothHandsVisible: false,
      leftVelocity: 0,
      rightVelocity: 0,
    };
  }

  async start(): Promise<void> {
    await this.initializeHands();
    this.isRunning = true;
    this.processFrame();
    console.log("🎥 Brainrot Detector started!");
  }

  stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    console.log("🛑 Brainrot Detector stopped");
  }

  private processFrame = async (): Promise<void> => {
    if (!this.isRunning || !this.hands || !this.video) return;

    if (this.video.readyState >= 2) {
      try {
        await this.hands.send({ image: this.video });
      } catch (error) {
        console.error('Error processing frame:', error);
      }
    }

    this.animationFrameId = requestAnimationFrame(this.processFrame);
  };

  // Start calibration phase
  startCalibration(): void {
    this.state.phase = "calibrating";
    this.state.calibration = {
      baselineY: 0,
      leftSamples: [],
      rightSamples: [],
      startTime: Date.now(),
    };
    this.state.count = 0;
    this.state.lastAlternationState = null;
    console.log("📐 Calibration started - hold hands level at hip height");
  }

  reset(): void {
    this.state = this.createInitialState();
  }

  getCount(): number {
    return this.state.count;
  }

  getPhase(): DetectorPhase {
    return this.state.phase;
  }

  getState(): DetectionFrame {
    const calibrationProgress = this.getCalibrationProgress();
    return {
      phase: this.state.phase,
      count: this.state.count,
      isAlternating: this.state.isCurrentlyAlternating,
      bothHandsVisible: this.state.bothHandsVisible,
      leftVelocity: this.state.leftVelocity,
      rightVelocity: this.state.rightVelocity,
      alternationState: this.state.lastAlternationState,
      calibrationProgress,
      baselineY: this.state.calibration?.baselineY ?? null,
    };
  }

  private getCalibrationProgress(): number {
    if (this.state.phase !== "calibrating" || !this.state.calibration) return 0;
    const elapsed = Date.now() - this.state.calibration.startTime;
    return Math.min(elapsed / this.config.calibrationDuration, 1);
  }

  updateConfig(config: Partial<BrainrotConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Exponential smoothing to reduce jitter
  private smooth(oldValue: number | null, newValue: number): number {
    if (oldValue === null) return newValue;
    return oldValue * this.config.smoothingFactor + newValue * (1 - this.config.smoothingFactor);
  }

  // Calculate velocity from position history
  private calculateVelocity(history: number[]): number {
    if (history.length < 2) return 0;

    const recent = history.slice(-this.config.velocityWindow);
    if (recent.length < 2) return 0;

    // Average velocity over the window
    let totalVelocity = 0;
    for (let i = 1; i < recent.length; i++) {
      totalVelocity += recent[i] - recent[i - 1];
    }
    return totalVelocity / (recent.length - 1);
  }

  // Get palm center Y (average of wrist and middle MCP for stability)
  private getPalmY(landmarks: NormalizedLandmark[]): number {
    const wristY = landmarks[WRIST].y;
    const midY = landmarks[MIDDLE_MCP].y;
    return (wristY + midY) / 2;
  }

  private onResults(results: Results): void {
    this.ctx.save();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(results.image, 0, 0, this.canvas.width, this.canvas.height);

    let rawLeftY: number | null = null;
    let rawRightY: number | null = null;

    if (results.multiHandLandmarks && results.multiHandedness) {
      for (let i = 0; i < results.multiHandLandmarks.length; i++) {
        const landmarks = results.multiHandLandmarks[i];
        const handedness = results.multiHandedness[i];

        // MediaPipe "Right" = user's left hand (mirrored camera)
        const isLeft = handedness.label === "Right";
        const color = isLeft ? "#FF6B6B" : "#4ECDC4";

        drawConnectors(this.ctx, landmarks, HAND_CONNECTIONS, {
          color: color,
          lineWidth: 2,
        });
        drawLandmarks(this.ctx, landmarks, {
          color: "#FFFFFF",
          lineWidth: 1,
          radius: 3,
        });

        const palmY = this.getPalmY(landmarks);

        if (isLeft) {
          rawLeftY = palmY;
        } else {
          rawRightY = palmY;
        }
      }
    }

    // Update state with smoothed values
    this.state.bothHandsVisible = rawLeftY !== null && rawRightY !== null;

    if (rawLeftY !== null) {
      this.state.leftY = this.smooth(this.state.leftY, rawLeftY);
      this.state.leftHistory.push(this.state.leftY);
      if (this.state.leftHistory.length > 10) {
        this.state.leftHistory.shift();
      }
    } else {
      this.state.leftY = null;
      this.state.leftHistory = [];
    }

    if (rawRightY !== null) {
      this.state.rightY = this.smooth(this.state.rightY, rawRightY);
      this.state.rightHistory.push(this.state.rightY);
      if (this.state.rightHistory.length > 10) {
        this.state.rightHistory.shift();
      }
    } else {
      this.state.rightY = null;
      this.state.rightHistory = [];
    }

    // Calculate velocities
    this.state.leftVelocity = this.calculateVelocity(this.state.leftHistory);
    this.state.rightVelocity = this.calculateVelocity(this.state.rightHistory);

    // Handle different phases
    if (this.state.phase === "calibrating") {
      this.handleCalibration();
    } else if (this.state.phase === "active") {
      this.detectAlternation();
    }

    // Draw overlay
    this.drawOverlay();

    // Fire callback
    this.onFrame?.(this.getState());

    this.ctx.restore();
  }

  private handleCalibration(): void {
    const { leftY, rightY } = this.state;
    const cal = this.state.calibration!;

    // Need both hands visible during calibration
    if (leftY === null || rightY === null) {
      // Reset calibration if hands disappear
      cal.leftSamples = [];
      cal.rightSamples = [];
      cal.startTime = Date.now(); // Restart timer
      return;
    }

    // Check hands are roughly level
    const yDiff = Math.abs(leftY - rightY);
    if (yDiff > this.config.calibrationTolerance) {
      // Hands not level - restart
      cal.leftSamples = [];
      cal.rightSamples = [];
      cal.startTime = Date.now();
      return;
    }

    // Collect samples
    cal.leftSamples.push(leftY);
    cal.rightSamples.push(rightY);

    // Check if calibration complete
    const elapsed = Date.now() - cal.startTime;
    if (elapsed >= this.config.calibrationDuration) {
      // Calculate baseline as average of all samples
      const avgLeft = cal.leftSamples.reduce((a, b) => a + b, 0) / cal.leftSamples.length;
      const avgRight = cal.rightSamples.reduce((a, b) => a + b, 0) / cal.rightSamples.length;
      cal.baselineY = (avgLeft + avgRight) / 2;

      // Transition to active
      this.state.phase = "active";
      console.log(`✅ Calibration complete! Baseline Y: ${cal.baselineY.toFixed(3)}`);
      this.onCalibrationComplete?.(cal.baselineY);
    }
  }

  private detectAlternation(): void {
    const { leftY, rightY, leftVelocity, rightVelocity, calibration } = this.state;

    // Need both hands
    if (leftY === null || rightY === null) {
      this.state.isCurrentlyAlternating = false;
      return;
    }

    // Use calibrated baseline if available
    const baseline = calibration?.baselineY ?? (leftY + rightY) / 2;

    // Calculate positions relative to baseline
    const leftOffset = leftY - baseline;  // Positive = below baseline
    const rightOffset = rightY - baseline;

    // Check vertical separation
    const yDifference = leftY - rightY; // Positive = left lower (higher Y value)

    let currentState: AlternationState = null;

    if (yDifference > this.config.minYDifference) {
      currentState = "right-up"; // Right hand is higher (lower Y value)
    } else if (yDifference < -this.config.minYDifference) {
      currentState = "left-up";
    }

    // Check if hands are actually moving
    const leftMoving = Math.abs(leftVelocity) > this.config.minVelocity;
    const rightMoving = Math.abs(rightVelocity) > this.config.minVelocity;
    const bothMoving = leftMoving && rightMoving;

    // Anti-cheat: hands should move in opposite directions
    let oppositeMotion = true;
    if (this.config.requireOppositeMotion) {
      // One hand going up (negative velocity) while other goes down (positive)
      oppositeMotion = (leftVelocity * rightVelocity) < 0;
    }

    // Valid alternation requires: position difference + movement + opposite directions
    const validMotion = bothMoving && oppositeMotion;

    if (currentState !== null && validMotion) {
      this.state.isCurrentlyAlternating = true;

      // Count when state flips
      if (
        this.state.lastAlternationState !== null &&
        this.state.lastAlternationState !== currentState
      ) {
        this.state.count++;
        this.onCount?.(this.state.count);
        console.log(`🔥 6-7 Count: ${this.state.count}`);
      }

      this.state.lastAlternationState = currentState;
    } else {
      this.state.isCurrentlyAlternating = false;
    }
  }

  private drawOverlay(): void {
    const { phase } = this.state;

    if (phase === "idle") {
      this.drawIdleOverlay();
    } else if (phase === "calibrating") {
      this.drawCalibrationOverlay();
    } else {
      this.drawActiveOverlay();
    }
  }

  private drawIdleOverlay(): void {
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    this.ctx.fillRect(10, 10, 250, 60);

    this.ctx.font = "bold 18px Arial";
    this.ctx.fillStyle = "#FFFFFF";
    this.ctx.fillText("Press START to calibrate", 25, 45);
  }

  private drawCalibrationOverlay(): void {
    const progress = this.getCalibrationProgress();
    const { bothHandsVisible, leftY, rightY } = this.state;

    // Background
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    this.ctx.fillRect(10, 10, 300, 100);

    // Title
    this.ctx.font = "bold 20px Arial";
    this.ctx.fillStyle = "#feca57";
    this.ctx.fillText("CALIBRATING...", 25, 38);

    // Instructions
    this.ctx.font = "14px Arial";
    this.ctx.fillStyle = "#FFFFFF";
    this.ctx.fillText("Hold both hands level at hip height", 25, 60);

    // Progress bar background
    this.ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    this.ctx.fillRect(25, 75, 260, 20);

    // Check if hands are level
    let handsLevel = false;
    if (bothHandsVisible && leftY !== null && rightY !== null) {
      handsLevel = Math.abs(leftY - rightY) <= this.config.calibrationTolerance;
    }

    // Progress bar fill
    this.ctx.fillStyle = handsLevel ? "#00FF88" : "#FF6666";
    this.ctx.fillRect(25, 75, 260 * progress, 20);

    // Progress text
    this.ctx.font = "bold 12px Arial";
    this.ctx.fillStyle = "#000000";
    const seconds = Math.ceil((1 - progress) * this.config.calibrationDuration / 1000);
    this.ctx.fillText(`${seconds}s`, 145, 89);

    // REMOVED: Status text (show both hands, keep hands level, hold steady)
    // The progress bar color (green/red) is enough visual feedback

    // Draw baseline guide line
    if (bothHandsVisible && leftY !== null && rightY !== null) {
      const avgY = ((leftY + rightY) / 2) * this.canvas.height;
      this.ctx.strokeStyle = handsLevel ? "#00FF88" : "#FFAA00";
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([10, 5]);
      this.ctx.beginPath();
      this.ctx.moveTo(0, avgY);
      this.ctx.lineTo(this.canvas.width, avgY);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }
  }

  private drawActiveOverlay(): void {
    const { count, isCurrentlyAlternating, bothHandsVisible, calibration } = this.state;

    // Main count box
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    this.ctx.fillRect(10, 10, 180, 100);

    // Count - big and bold
    this.ctx.font = "bold 56px Arial";
    this.ctx.fillStyle = isCurrentlyAlternating ? "#00FF88" : "#feca57";
    this.ctx.fillText(String(count), 25, 72);

    // Label
    this.ctx.font = "bold 12px Arial";
    this.ctx.fillStyle = "#FFFFFF";
    this.ctx.fillText("6-7 COUNT", 100, 35);

    // Status
    this.ctx.font = "bold 13px Arial";
    if (!bothHandsVisible) {
      this.ctx.fillStyle = "#FF6666";
      this.ctx.fillText("Show both hands", 25, 95);
    } else if (isCurrentlyAlternating) {
      this.ctx.fillStyle = "#00FF88";
      this.ctx.fillText("🔥 ACTIVE", 25, 95);
    } else {
      this.ctx.fillStyle = "#FFAA00";
      this.ctx.fillText("Ready - start moving!", 25, 95);
    }

    // Draw baseline reference line (faint)
    if (calibration?.baselineY) {
      const baselinePixelY = calibration.baselineY * this.canvas.height;
      this.ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      this.ctx.lineWidth = 1;
      this.ctx.setLineDash([5, 5]);
      this.ctx.beginPath();
      this.ctx.moveTo(0, baselinePixelY);
      this.ctx.lineTo(this.canvas.width, baselinePixelY);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }

    // Active border
    if (isCurrentlyAlternating) {
      this.ctx.strokeStyle = "#00FF88";
      this.ctx.lineWidth = 6;
      this.ctx.strokeRect(3, 3, this.canvas.width - 6, this.canvas.height - 6);
    }
  }
}

export default BrainrotDetector;
