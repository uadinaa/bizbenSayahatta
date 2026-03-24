import { useState, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchProfile } from "../slices/authSlice";
import api from "../api/axios";

const STATUS_LABELS = {
  PENDING: "Pending review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  MORE_INFO: "More info required",
};

function toList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

export function useAdvisor() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  const [categories, setCategories] = useState([]);
  const [applications, setApplications] = useState([]);
  const [advisorModalOpen, setAdvisorModalOpen] = useState(false);
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [advisorError, setAdvisorError] = useState("");
  const [advisorSuccess, setAdvisorSuccess] = useState("");
  const [advisorForm, setAdvisorForm] = useState({
    subscriptionPlan: "monthly",
    paymentReference: "",
    instagram: "",
    notes: "",
    portfolioText: "",
    categoryIds: [],
    contractAccepted: false,
    termsAccepted: false,
    cvFile: null,
  });

  useEffect(() => {
    if (!localStorage.getItem("access")) return;
    const loadAdvisorData = async () => {
      try {
        const [categoriesRes, applicationsRes] = await Promise.all([
          api.get("marketplace/categories/"),
          api.get("marketplace/advisor/applications/"),
        ]);
        setCategories(toList(categoriesRes.data));
        setApplications(toList(applicationsRes.data));
      } catch (err) {
        console.error("Failed to load advisor metadata", err);
      }
    };
    loadAdvisorData();
  }, []);

  const latestApplication = useMemo(() => {
    if (!applications.length) return null;
    return [...applications].sort((a, b) => b.id - a.id)[0];
  }, [applications]);

  const advisorStatus = useMemo(() => {
    if (user?.role === "TRIPADVISOR") return { code: "APPROVED", label: "Active TripAdvisor" };
    if (latestApplication?.status) return { code: latestApplication.status, label: STATUS_LABELS[latestApplication.status] || latestApplication.status };
    return { code: "NONE", label: "Not applied" };
  }, [user, latestApplication]);

  useEffect(() => {
    if (latestApplication?.status === "APPROVED" && user?.role !== "TRIPADVISOR") {
      dispatch(fetchProfile());
    }
  }, [latestApplication?.status, user?.role, dispatch]);

  const toggleCategory = (categoryId) => {
    setAdvisorForm((prev) =>
      prev.categoryIds.includes(categoryId)
        ? { ...prev, categoryIds: prev.categoryIds.filter((id) => id !== categoryId) }
        : { ...prev, categoryIds: [...prev.categoryIds, categoryId] }
    );
  };

  const submitAdvisorApplication = async () => {
    setAdvisorError("");
    setAdvisorSuccess("");
    setAdvisorLoading(true);
    try {
      const links = advisorForm.portfolioText.split("\n").map((l) => l.trim()).filter(Boolean);
      if (advisorForm.instagram.trim()) links.unshift(advisorForm.instagram.trim());

      const formData = new FormData();
      formData.append("contract_accepted", String(advisorForm.contractAccepted));
      formData.append("terms_accepted", String(advisorForm.termsAccepted));
      formData.append("subscription_plan", advisorForm.subscriptionPlan);
      formData.append("payment_reference", advisorForm.paymentReference);
      formData.append("notes", advisorForm.notes);
      advisorForm.categoryIds.forEach((id) => formData.append("category_ids", String(id)));
      formData.append("portfolio_links", JSON.stringify(links));
      if (advisorForm.cvFile) formData.append("cv_file", advisorForm.cvFile);

      await api.post("marketplace/advisor/apply/", formData);
      const applicationsRes = await api.get("marketplace/advisor/applications/");
      setApplications(toList(applicationsRes.data));
      setAdvisorModalOpen(false);
      setAdvisorSuccess("Application sent. Status is now Pending review.");
    } catch (err) {
      const backend = err?.response?.data;
      setAdvisorError(typeof backend === "string" ? backend : JSON.stringify(backend || "Failed to send application"));
    } finally {
      setAdvisorLoading(false);
    }
  };

  return {
    user, categories, applications, latestApplication, advisorStatus,
    advisorModalOpen, setAdvisorModalOpen,
    advisorLoading, advisorError, advisorSuccess,
    advisorForm, setAdvisorForm,
    toggleCategory, submitAdvisorApplication,
  };
}