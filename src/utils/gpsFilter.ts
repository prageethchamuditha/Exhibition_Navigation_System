import { getDistance } from './dijkstra';

/**
 * GPSKalmanFilter
 *
 * A 1D Kalman filter implementation optimized for filtering noise and jitter
 * in GPS coordinate streams. It dynamically adjusts smoothing based on the
 * reported accuracy (measurement error) and elapsed time, and applies a
 * dead-zone distance threshold to prevent drifting while stationary.
 */
export class GPSKalmanFilter {
  private minAccuracy: number; // Minimum accuracy floor in meters
  private q: number;           // Process noise coefficient (m/s)
  private r: number;           // Measurement noise weight factor
  
  private lat: number | null = null;
  private lng: number | null = null;
  private variance: number = -1; // Error covariance
  private lastTimestamp: number = 0;

  private lastStableLat: number | null = null;
  private lastStableLng: number | null = null;
  private deadZoneThreshold: number; // Threshold in meters to ignore tiny movements

  /**
   * @param q Process noise coefficient in meters per second (how fast the user is expected to move).
   *          Default 0.8 represents slow/typical walking acceleration noise.
   * @param deadZoneThreshold Distance in meters below which changes are ignored when stationary.
   *                          Default is 1.8 meters, which removes sub-2m jitter while standing still.
   * @param minAccuracy Minimum GPS accuracy constraint to prevent over-trusting bad readings.
   * @param r Measurement noise scale factor.
   */
  constructor(q = 0.5, deadZoneThreshold = 0.6, minAccuracy = 1.0, r = 0.08) {
    this.q = q;
    this.deadZoneThreshold = deadZoneThreshold;
    this.minAccuracy = minAccuracy;
    this.r = r;
  }

  /**
   * Reset the filter state (e.g. when tracking is stopped or location mode changes)
   */
  public reset() {
    this.lat = null;
    this.lng = null;
    this.variance = -1;
    this.lastTimestamp = 0;
    this.lastStableLat = null;
    this.lastStableLng = null;
  }

  /**
   * Run the Kalman Filter iteration on an incoming coordinate reading.
   *
   * @param newLat New raw latitude reading from GPS
   * @param newLng New raw longitude reading from GPS
   * @param accuracy Raw accuracy in meters reported by GPS (coords.accuracy)
   * @param timestamp Optional timestamp of reading. Defaults to Date.now()
   */
  public filter(
    newLat: number,
    newLng: number,
    accuracy: number | null,
    timestamp: number = Date.now()
  ): { lat: number; lng: number } {
    const rawAccuracy = accuracy !== null ? accuracy : 10.0;
    const currentAccuracy = Math.max(rawAccuracy, this.minAccuracy);

    // 1. Initialize on the very first coordinate reading
    if (this.lat === null || this.lng === null || this.variance < 0) {
      this.lat = newLat;
      this.lng = newLng;
      this.lastStableLat = newLat;
      this.lastStableLng = newLng;
      this.variance = currentAccuracy * currentAccuracy;
      this.lastTimestamp = timestamp;
      return { lat: newLat, lng: newLng };
    }

    // 2. Calculate time duration (seconds) since last update
    const duration = (timestamp - this.lastTimestamp) / 1000.0;
    this.lastTimestamp = timestamp;

    // 3. Prediction step (variance increases over time due to process noise)
    if (duration > 0) {
      this.variance += duration * this.q * this.q;
    }

    // 4. Update / Correction step
    // Kalman gain K = error_covariance / (error_covariance + measurement_noise)
    const measurementVariance = currentAccuracy * currentAccuracy * this.r;
    const k = this.variance / (this.variance + measurementVariance);

    // Calculate new filtered estimates
    const filteredLat = this.lat + k * (newLat - this.lat);
    const filteredLng = this.lng + k * (newLng - this.lng);

    // Update error covariance: (1 - K) * variance
    this.variance = (1.0 - k) * this.variance;

    // Save estimates for prediction in the next cycle
    this.lat = filteredLat;
    this.lng = filteredLng;

    // 5. Apply Dead-Zone Thresholding
    const dist = getDistance(this.lastStableLat!, this.lastStableLng!, filteredLat, filteredLng);
    if (dist >= this.deadZoneThreshold) {
      this.lastStableLat = filteredLat;
      this.lastStableLng = filteredLng;
    }

    return { lat: this.lastStableLat!, lng: this.lastStableLng! };
  }
}
