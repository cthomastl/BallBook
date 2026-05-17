import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost/api';

// Axios instance
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach token from localStorage if present
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('ballbook_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: surface error messages
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.message ||
      'An unexpected error occurred';
    error.displayMessage = message;
    return Promise.reject(error);
  }
);

// ============================================================
// Auth API
// ============================================================
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: (token) =>
    api.get('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    }),
};

// ============================================================
// Search / Trainers API
// ============================================================
export const searchAPI = {
  searchTrainers: (params) => api.get('/search/trainers', { params }),
  getTrainer: (id) => api.get(`/search/trainers/${id}`),
  getAvailability: (trainerId) => api.get(`/search/availability/${trainerId}`),
  getFeatured: () => api.get('/search/featured'),
};

// ============================================================
// Bookings API
// ============================================================
export const bookingsAPI = {
  createBooking: (data) => api.post('/bookings/', data),
  getUserBookings: (userId) => api.get(`/bookings/user/${userId}`),
  cancelBooking: (bookingId) => api.delete(`/bookings/${bookingId}`),
};

// ============================================================
// Pricing API
// ============================================================
export const pricingAPI = {
  calculatePrice: (data) => api.post('/pricing/calculate', data),
};

export default api;
