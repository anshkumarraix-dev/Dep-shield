/**
 * Environment configuration for DepShield Frontend
 * Manages mode selection (Mock vs. Live FastAPI backend) and base API URLs.
 */

export const envConfig = {
  /**
   * Set to true when NEXT_PUBLIC_USE_MOCKS is '1', 'true', or undefined in dev mode.
   * Explicitly setting NEXT_PUBLIC_USE_MOCKS=0 directs traffic to the FastAPI backend.
   */
  useMocks: process.env.NEXT_PUBLIC_USE_MOCKS !== '0',
  
  /**
   * Base URL for the FastAPI backend service.
   */
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000',
  
  /**
   * Current deployment environment identifier
   */
  nodeEnv: process.env.NODE_ENV || 'development',
} as const;
