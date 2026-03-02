import React, {
  createContext,
  useContext,
  useCallback,
  useState,
  useRef,
  useEffect,
  ReactNode,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Constants from 'expo-constants';
import { NavigationContainerRef } from '@react-navigation/native';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RefreshTokenResponse {
  status: string;
  token: string;
  token_type: string;
  expires_in: number;
}

interface AuthContextType {
  isAuthenticated: boolean | null;
  showSessionExpiry: boolean;
  countdownSeconds: number;
  setIsAuthenticated: (value: boolean | null) => void;
  handleLogout: (showMessage?: boolean) => Promise<void>;
  refreshToken: () => Promise<boolean>;
  dismissSessionExpiry: () => void;
  setupExpirationTimer: () => Promise<void>;
  setNavigationRef: (ref: NavigationContainerRef<any>) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [showSessionExpiry, setShowSessionExpiry] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(10);
  
  const navigationRef = useRef<NavigationContainerRef<any> | null>(null);
  const tokenCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const countdownInterval = useRef<NodeJS.Timeout | null>(null);
  const expirationTimeout = useRef<NodeJS.Timeout | null>(null);
  const appState = useRef(AppState.currentState);
  const setupExpirationTimerRef = useRef<() => Promise<void>>(async () => {});

  const setNavigationRef = useCallback((ref: NavigationContainerRef<any>) => {
    navigationRef.current = ref;
  }, []);

  // Clear all timers
  const clearAllTimers = useCallback(() => {
    if (tokenCheckInterval.current) {
      clearInterval(tokenCheckInterval.current);
      tokenCheckInterval.current = null;
    }
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
      countdownInterval.current = null;
    }
    if (expirationTimeout.current) {
      clearTimeout(expirationTimeout.current);
      expirationTimeout.current = null;
    }
  }, []);

  // Dismiss session expiry modal
  const dismissSessionExpiry = useCallback(() => {
    setShowSessionExpiry(false);
    setCountdownSeconds(10);
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
      countdownInterval.current = null;
    }
  }, []);

  // Logout function
  const handleLogout = useCallback(async (showMessage: boolean = true) => {
    clearAllTimers();
    dismissSessionExpiry();
    
    await AsyncStorage.multiRemove(['token', 'user', 'tokenExpiresAt']);
    setIsAuthenticated(false);

    // Navigate to Signin
    if (navigationRef.current?.isReady()) {
      navigationRef.current.reset({
        index: 0,
        routes: [{ name: 'Signin' }],
      });
    }
  }, [clearAllTimers, dismissSessionExpiry]);

  // Refresh token
  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      const apiUrl = Constants.expoConfig?.extra?.apiUrl || '';
      const currentToken = await AsyncStorage.getItem('token');
      
      if (!currentToken) {
        await handleLogout(false);
        return false;
      }

      const response = await axios.post<RefreshTokenResponse>(
        `${apiUrl}/api/auth/refresh`,
        {},
        {
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
        }
      );

      if (response.data.status === 'success' && response.data.token) {
        // Store new token
        await AsyncStorage.setItem('token', response.data.token);
        
        // Calculate and store new expiration time
        const expiresAt = Date.now() + response.data.expires_in * 1000;
        await AsyncStorage.setItem('tokenExpiresAt', expiresAt.toString());
        
        // Dismiss the modal and reset countdown
        dismissSessionExpiry();
        
        // Setup new expiration timer (use ref to get latest version)
        await setupExpirationTimerRef.current();
        
        return true;
      }
      
      return false;
    } catch (error) {
      // Token refresh failed, logout user
      await handleLogout(false);
      return false;
    }
  }, [handleLogout, dismissSessionExpiry]);

  // Start countdown and show modal
  const startSessionExpiryCountdown = useCallback(() => {
    setCountdownSeconds(10);
    setShowSessionExpiry(true);
    
    // Clear any existing countdown
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
    }
    
    countdownInterval.current = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev <= 1) {
          // Time's up, logout
          if (countdownInterval.current) {
            clearInterval(countdownInterval.current);
            countdownInterval.current = null;
          }
          handleLogout(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [handleLogout]);

  // Check if token is expired
  const checkTokenExpiration = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const expiresAtStr = await AsyncStorage.getItem('tokenExpiresAt');
      
      if (!token || !expiresAtStr) {
        return false;
      }

      const expiresAt = parseInt(expiresAtStr, 10);
      const now = Date.now();
      
      // Check if token is expired or will expire in next 30 seconds
      if (now >= expiresAt - 30000) {
        startSessionExpiryCountdown();
        return false;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }, [startSessionExpiryCountdown]);

  // Setup token expiration timer
  const setupExpirationTimer = useCallback(async () => {
    // Clear existing timers
    clearAllTimers();

    const expiresAtStr = await AsyncStorage.getItem('tokenExpiresAt');
    if (!expiresAtStr) return;

    const expiresAt = parseInt(expiresAtStr, 10);
    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;

    // If already expired
    if (timeUntilExpiry <= 0) {
      startSessionExpiryCountdown();
      return;
    }

    // Set timeout to show session expiry modal 30 seconds before expiry
    const timeoutDelay = Math.max(0, timeUntilExpiry - 30000);
    expirationTimeout.current = setTimeout(() => {
      startSessionExpiryCountdown();
    }, timeoutDelay);

    // Also check every minute as a safety net
    tokenCheckInterval.current = setInterval(checkTokenExpiration, 60000);
  }, [clearAllTimers, startSessionExpiryCountdown, checkTokenExpiration]);

  // Keep ref up to date with latest setupExpirationTimer
  useEffect(() => {
    setupExpirationTimerRef.current = setupExpirationTimer;
  }, [setupExpirationTimer]);

  // Handle app state changes (foreground/background)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      // App came to foreground
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // Only check if not already showing the expiry modal
        if (!showSessionExpiry) {
          await checkTokenExpiration();
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [checkTokenExpiration, showSessionExpiry]);

  // Check auth status on mount
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const expiresAtStr = await AsyncStorage.getItem('tokenExpiresAt');
        
        if (!token) {
          setIsAuthenticated(false);
          return;
        }

        // Check if token is expired
        if (expiresAtStr) {
          const expiresAt = parseInt(expiresAtStr, 10);
          if (Date.now() >= expiresAt) {
            // Token expired, clear storage and set as not authenticated
            await AsyncStorage.multiRemove(['token', 'user', 'tokenExpiresAt']);
            setIsAuthenticated(false);
            return;
          }
        }

        setIsAuthenticated(true);
        // Setup expiration timer for valid token
        await setupExpirationTimer();
      } catch (error) {
        setIsAuthenticated(false);
      }
    };

    checkAuthStatus();

    // Cleanup on unmount
    return () => {
      clearAllTimers();
    };
  }, [setupExpirationTimer, clearAllTimers]);

  // Cleanup countdown on unmount
  useEffect(() => {
    return () => {
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
    };
  }, []);

  const value: AuthContextType = {
    isAuthenticated,
    showSessionExpiry,
    countdownSeconds,
    setIsAuthenticated,
    handleLogout,
    refreshToken,
    dismissSessionExpiry,
    setupExpirationTimer,
    setNavigationRef,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
