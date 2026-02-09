import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../api/axios";

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
      localStorage.setItem("access", res.data.access);
      localStorage.setItem("refresh", res.data.refresh);
      return res.data;
    } catch {
      return rejectWithValue("Invalid credentials");
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
      return rejectWithValue(err.response?.data || "Cannot fetch profile");
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
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.user = action.payload;
        state.loading = false;
      })
      .addCase(fetchProfile.rejected, (state, action) => {
        state.user = null;
        state.loading = false;
        state.error = action.payload;
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
