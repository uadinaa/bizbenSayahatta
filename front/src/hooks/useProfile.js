import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { fetchProfile, logoutUser } from "../slices/authSlice";
import api from "../api/axios";
import profileIcon from "../assets/profile.svg";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

export function resolveMediaUrl(url, fallback) {
  if (!url) return fallback;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_BASE}${url}`;
}

export function useProfile() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const defaultAvatar = profileIcon;

  const [username, setUsername] = useState("Username");
  const [avatar, setAvatar] = useState(defaultAvatar);
  const [cover, setCover] = useState(null);
  const [email, setEmail] = useState("user@email.com");
  const [travelStyle, setTravelStyle] = useState("Not set");

  const [tempUsername, setTempUsername] = useState(username);
  const [tempAvatar, setTempAvatar] = useState(avatar);
  const [tempStyle, setTempStyle] = useState(travelStyle);
  const [avatarFile, setAvatarFile] = useState(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [privacySettings, setPrivacySettings] = useState({
    share_map: false,
    share_visited_places: false,
    share_badges: false,
  });
  const [privacySaving, setPrivacySaving] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("access")) dispatch(fetchProfile());
  }, [dispatch]);

  useEffect(() => {
    if (!user) return;
    setEmail(user.email || "user@email.com");
    setUsername(user.username || "Username");
    setTravelStyle(user.preferences?.travel_style || "Not set");
    const resolvedAvatar = resolveMediaUrl(user.avatar, defaultAvatar);
    setAvatar(resolvedAvatar);
    setTempAvatar(resolvedAvatar);
    setCover(resolveMediaUrl(user.cover, null));
    setPrivacySettings({
      share_map: Boolean(user.preferences?.share_map),
      share_visited_places: Boolean(user.preferences?.share_visited_places),
      share_badges: Boolean(user.preferences?.share_badges),
    });
  }, [user]);

  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });

  const openEditModal = () => {
    setTempUsername(username);
    setTempAvatar(avatar);
    setTempStyle(travelStyle);
    setAvatarFile(null);
    setIsEditOpen(true);
  };

  const saveChanges = async () => {
    try {
      const profileRes = await api.put("users/profile/", {
        username: tempUsername,
        travel_style: tempStyle === "Not set" ? null : tempStyle,
      });
      let updatedUserData = profileRes.data;
      if (avatarFile) {
        const formData = new FormData();
        formData.append("avatar", avatarFile);
        const avatarRes = await api.patch("users/profile/", formData);
        updatedUserData = avatarRes.data;
      }
      const resolvedAvatar = resolveMediaUrl(updatedUserData.avatar, defaultAvatar);
      setUsername(updatedUserData.username || "Username");
      setTravelStyle(updatedUserData.preferences?.travel_style || "Not set");
      setAvatar(resolvedAvatar);
      setAvatarFile(null);
      setIsEditOpen(false);
    } catch (err) {
      const backendError = err?.response?.data;
      alert(typeof backendError === "string" ? backendError : JSON.stringify(backendError || "Failed to save profile"));
    }
  };

  const handleCoverChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append("cover", file);
      const res = await api.patch("users/profile/", formData);
      setCover(resolveMediaUrl(res.data.cover, null));
    } catch (err) {
      console.error("Failed to upload cover", err);
    }
  };

  const handleLogout = () => {
    dispatch(logoutUser());
    navigate("/login");
  };

  const updatePrivacySetting = async (field, value) => {
    setPrivacySettings((prev) => ({ ...prev, [field]: value }));
    setPrivacySaving(true);
    try {
      const res = await api.patch("users/profile/privacy/", { [field]: value });
      setPrivacySettings({
        share_map: Boolean(res.data?.share_map),
        share_visited_places: Boolean(res.data?.share_visited_places),
        share_badges: Boolean(res.data?.share_badges),
      });
      await dispatch(fetchProfile());
    } catch (err) {
      setPrivacySettings((prev) => ({ ...prev, [field]: !value }));
      const backendError = err?.response?.data;
      alert(typeof backendError === "string" ? backendError : JSON.stringify(backendError || "Failed to update privacy"));
    } finally {
      setPrivacySaving(false);
    }
  };

  return {
    // data
    user, email, username, avatar, cover, travelStyle, defaultAvatar,
    privacySettings, privacySaving,
    // edit modal
    isEditOpen, tempUsername, tempAvatar, tempStyle, avatarFile,
    setTempUsername, setTempAvatar, setTempStyle, setAvatarFile, setIsEditOpen,
    // actions
    openEditModal, saveChanges, handleCoverChange, handleLogout, fileToBase64,
    updatePrivacySetting,
  };
}