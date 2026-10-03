const API_BASE_URL = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? "https://shopnest-fhy1.onrender.com" : "")
).replace(/\/+$/, "");

export const apiUrl = (path) =>
  API_BASE_URL ? `${API_BASE_URL}${path}` : path;

let refreshPromise = null;

const refreshAccessToken = async () => {
  // Prevent multiple refresh requests at the same time
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch(apiUrl("/api/auth/refresh"), {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      if (!data.accessToken) {
        return null;
      }

      // Update stored access token
      const storedUser = localStorage.getItem("userInfo");

      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);

          const updatedUser = {
            ...user,
            token: data.accessToken,
          };

          localStorage.setItem("userInfo", JSON.stringify(updatedUser));
        } catch (error) {
          console.error("Error updating access token:", error);
        }
      }

      return data.accessToken;
    } catch (error) {
      console.error("Refresh token request failed:", error);

      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

export const apiFetch = async (url, options = {}) => {
  const storedUser = localStorage.getItem("userInfo");

  let user = null;

  try {
    user = storedUser ? JSON.parse(storedUser) : null;
  } catch (error) {
    console.error("Invalid userInfo:", error);
  }

  const headers = new Headers(options.headers || {});

  // Add access token
  if (user?.token) {
    headers.set("Authorization", `Bearer ${user.token}`);
  }

  // Don't manually set Content-Type for FormData
  // Browser will automatically set multipart boundary.
  const isFormData = options.body instanceof FormData;

  if (!isFormData && options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const requestOptions = {
    ...options,
    headers,
    credentials: "include",
  };

  let response = await fetch(apiUrl(url), requestOptions);

  // Access token expired
  if (response.status === 401) {
    const newAccessToken = await refreshAccessToken();

    if (!newAccessToken) {
      localStorage.removeItem("userInfo");

      return response;
    }

    // Retry original request with new access token
    const retryHeaders = new Headers(options.headers || {});

    retryHeaders.set("Authorization", `Bearer ${newAccessToken}`);

    if (!isFormData && options.body && !retryHeaders.has("Content-Type")) {
      retryHeaders.set("Content-Type", "application/json");
    }

    response = await fetch(apiUrl(url), {
      ...options,
      headers: retryHeaders,
      credentials: "include",
    });
  }

  return response;
};

export default apiFetch;
