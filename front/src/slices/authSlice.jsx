import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../api/axios";
import { clearClientUserData, resetClientUserDataOnSessionChange } from "../utils/sessionData";

/* SIGNUP */
export const signUpUser = createAsyncThunk(
  "auth/signup",
  async (data, { rejectWithValue }) => {
    try {
      const res = await api.post("users/signup/", data);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data || "Signup failed");
    }
  }
);

/* LOGIN */
export const loginUser = createAsyncThunk(
  "auth/login",
  async (data, { rejectWithValue }) => {
    try {
      const res = await api.post("token/", data);
      resetClientUserDataOnSessionChange(res.data.access);
      localStorage.setItem("access", res.data.access);
      localStorage.setItem("refresh", res.data.refresh);
      return res.data;
    } catch (err) {
      clearClientUserData();
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
      return rejectWithValue(err.response?.data?.detail || "Invalid credentials");
    }
  }
);

/* PROFILE */
export const fetchProfile = createAsyncThunk(
  "auth/profile",
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get("users/profile/");
      return res.data; // this will now be JSON
    } catch (err) {
      return rejectWithValue({
        status: err.response?.status,
        data: err.response?.data || "Cannot fetch profile",
      });
    }
  }
);

export const updatePreferences = createAsyncThunk(
  "auth/updatePreferences",
  async (data, { rejectWithValue }) => {
    try {
      const res = await api.put("users/profile/", data);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data || "Cannot update profile");
    }
  }
);

/* AVATAR UPLOAD */
export const uploadUserPhoto = createAsyncThunk(
  "auth/uploadPhoto",
  async (file, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append("avatar", file);

      const res = await api.patch("users/profile/", formData);
      return res.data;
    } catch {
      return rejectWithValue("Avatar upload failed");
    }
  }
);

/* SLICE */
const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: null,
    loading: false,
    error: null,
  },
  reducers: {
    logoutUser: (state) => {
      state.user = null;
      state.error = null;
      state.loading = false;
      clearClientUserData();
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(signUpUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signUpUser.fulfilled, (state) => {
        state.loading = false;
        state.error = null;
      })
      .addCase(signUpUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state) => {
        state.loading = false;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.user = action.payload;
        state.loading = false;
      })
      .addCase(fetchProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.data || action.payload || "Cannot fetch profile";

        const status = action.payload?.status ?? action.error?.status;
        if (status === 401 || status === 403) {
          state.user = null;
          clearClientUserData();
          localStorage.removeItem("access");
          localStorage.removeItem("refresh");
        }
      })
      .addCase(updatePreferences.fulfilled, (state, action) => {
        if (state.user) {
          state.user.preferences = action.payload;
        }
      })
      .addCase(uploadUserPhoto.fulfilled, (state, action) => {
        state.user = action.payload;
      });
  },
});

export const { logoutUser } = authSlice.actions;
export default authSlice.reducer;
