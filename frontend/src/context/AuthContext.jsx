import React, { createContext, useState, useEffect, useCallback } from "react";

export const AuthContext = createContext();

const getStoredUser = () => {
  try {
    const storedUser = localStorage.getItem("userInfo");

    if (!storedUser) {
      return null;
    }

    return JSON.parse(storedUser);
  } catch (error) {
    console.error("Error reading userInfo:", error);
    localStorage.removeItem("userInfo");
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getStoredUser);
  const [loading, setLoading] = useState(true);

  // Save user + access token
  const login = useCallback((userData) => {
    if (!userData) {
      return;
    }

    setUser(userData);
    localStorage.setItem("userInfo", JSON.stringify(userData));
  }, []);

  // Update only access token after refresh
  const updateAccessToken = useCallback((newAccessToken) => {
    setUser((currentUser) => {
      if (!currentUser) {
        return null;
      }

      const updatedUser = {
        ...currentUser,
        token: newAccessToken,
      };

      localStorage.setItem("userInfo", JSON.stringify(updatedUser));

      return updatedUser;
    });
  }, []);

  const updateUser = useCallback((userData) => {
    setUser((currentUser) => {
      if (!currentUser) return null;
      const updatedUser = { ...currentUser, ...userData };
      localStorage.setItem("userInfo", JSON.stringify(updatedUser));
      return updatedUser;
    });
  }, []);

  // Logout
  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: user?.token
          ? {
              Authorization: `Bearer ${user.token}`,
            }
          : {},
      });
    } catch (error) {
      console.error("Logout API Error:", error);
    } finally {
      setUser(null);
      localStorage.removeItem("userInfo");
    }
  }, [user]);

  // Try to get a fresh access token when app loads
  useEffect(() => {
    const restoreSession = async () => {
      if (!localStorage.getItem("userInfo")) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "include",
        });

        if (!response.ok) {
          setLoading(false);
          return;
        }

        const data = await response.json();

        if (data.accessToken) {
          updateAccessToken(data.accessToken);
        }
      } catch (error) {
        console.error("Session restore error:", error);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, [updateAccessToken]);

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        updateAccessToken,
        updateUser,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
