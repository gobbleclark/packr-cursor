const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export interface LoginData {
  email: string;
  password: string;
}

export interface SignupData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyName: string;
  companySlug: string;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    threeplId?: string;
    brandId?: string;
    companyName?: string;
    companySlug?: string;
  };
}

export interface ApiError {
  error: string;
  message: string;
  details?: any;
}

class AuthService {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token);
    }
  }

  getToken(): string | null {
    if (!this.token && typeof window !== 'undefined') {
      this.token = localStorage.getItem('token');
    }
    return this.token;
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }
  }

  async login(data: LoginData): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Login failed');
    }

    if (result.success) {
      this.setToken(result.token);
    }

    return result;
  }

  async signup(data: SignupData): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE}/api/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Signup failed');
    }

    if (result.success) {
      this.setToken(result.token);
    }

    return result;
  }

  async verifyToken(): Promise<AuthResponse | null> {
    const token = this.getToken();
    if (!token) return null;

    try {
      const response = await fetch(`${API_BASE}/api/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        this.clearToken();
        return null;
      }

      const result = await response.json();
      return result.success ? result : null;
    } catch (error) {
      this.clearToken();
      return null;
    }
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  async getAuthenticatedUser(): Promise<AuthResponse['user'] | null> {
    const authResponse = await this.verifyToken();
    return authResponse ? authResponse.user : null;
  }

  logout() {
    this.clearToken();
  }
}

export const authService = new AuthService();
