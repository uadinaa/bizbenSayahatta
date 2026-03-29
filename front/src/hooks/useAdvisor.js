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

const DEFAULT_PAY_AMOUNT = "1.00";
const DEFAULT_CURRENCY = "usd";

function getPaymentAmount() {
  const raw = import.meta.env?.VITE_TRIPADVISOR_PAYMENT_AMOUNT;
  return (raw && String(raw).trim()) || DEFAULT_PAY_AMOUNT;
}

function getPaymentCurrency() {
  const raw = import.meta.env?.VITE_TRIPADVISOR_PAYMENT_CURRENCY;
  return (raw && String(raw).trim().toLowerCase()) || DEFAULT_CURRENCY;
}

export function useAdvisor() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  const [applications, setApplications] = useState([]);
  const [advisorModalOpen, setAdvisorModalOpen] = useState(false);
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [advisorError, setAdvisorError] = useState("");
  const [advisorSuccess, setAdvisorSuccess] = useState("");
  const [advisorForm, setAdvisorForm] = useState({
    instagram: "",
    notes: "",
    portfolioText: "",
    contractAccepted: false,
    termsAccepted: false,
    cvFile: null,
  });

  useEffect(() => {
    if (!localStorage.getItem("access")) return;
    const loadApplications = async () => {
      try {
        const applicationsRes = await api.get("marketplace/advisor/applications/");
        setApplications(toList(applicationsRes.data));
      } catch (err) {
        console.error("Failed to load advisor applications", err);
      }
    };
    loadApplications();
  }, []);

  const latestApplication = useMemo(() => {
    if (!applications.length) return null;
    return [...applications].sort((a, b) => b.id - a.id)[0];
  }, [applications]);

  const advisorStatus = useMemo(() => {
    if (user?.role === "TRIPADVISOR") return { code: "APPROVED", label: "Active TripAdvisor" };
    if (latestApplication?.status) {
      return {
        code: latestApplication.status,
        label: STATUS_LABELS[latestApplication.status] || latestApplication.status,
      };
    }
    return { code: "NONE", label: "Not applied" };
  }, [user, latestApplication]);

  useEffect(() => {
    if (latestApplication?.status === "APPROVED" && user?.role !== "TRIPADVISOR") {
      dispatch(fetchProfile());
    }
  }, [latestApplication?.status, user?.role, dispatch]);

  const submitAdvisorApplication = async () => {
    setAdvisorError("");
    setAdvisorSuccess("");
    setAdvisorLoading(true);
    try {
      const links = advisorForm.portfolioText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      if (advisorForm.instagram.trim()) links.unshift(advisorForm.instagram.trim());

      const formData = new FormData();
      formData.append("contract_accepted", String(advisorForm.contractAccepted));
      formData.append("terms_accepted", String(advisorForm.termsAccepted));
      formData.append("subscription_plan", "stripe");
      formData.append("payment_reference", "");
      formData.append("notes", advisorForm.notes);
      formData.append("portfolio_links", JSON.stringify(links));
      if (advisorForm.cvFile) formData.append("cv_file", advisorForm.cvFile);

      try {
        await api.post("marketplace/advisor/apply/", formData);
      } catch (applyErr) {
        const st = applyErr?.response?.status;
        const detail = applyErr?.response?.data?.detail;
        const pending =
          st === 400 &&
          typeof detail === "string" &&
          detail.toLowerCase().includes("already pending");
        if (!pending) throw applyErr;
      }

      const payRes = await api.post("payments/create/", {
        amount: getPaymentAmount(),
        currency: getPaymentCurrency(),
      });

      const checkoutUrl = payRes.data?.checkout_url;
      if (!checkoutUrl) {
        setAdvisorError(
          "Application saved but payment link is missing. Check STRIPE_PAYMENT_LINK_URL on the server.",
        );
        const applicationsRes = await api.get("marketplace/advisor/applications/");
        setApplications(toList(applicationsRes.data));
        return;
      }

      setAdvisorModalOpen(false);
      setAdvisorSuccess("Redirecting to payment…");
      window.location.assign(checkoutUrl);
    } catch (err) {
      const status = err?.response?.status;
      const backend = err?.response?.data;
      let msg =
        typeof backend === "object" && backend !== null && backend.detail
          ? backend.detail
          : typeof backend === "string"
            ? backend
            : err?.userMessage || "Request failed";
      if (typeof msg !== "string") {
        msg = JSON.stringify(backend || "Request failed");
      }
      if (status === 404 && String(err?.config?.url || "").includes("payments")) {
        msg =
          "Payment API not found (404). Restart the backend and open /api/payments/create/ with a trailing slash.";
      }
      setAdvisorError(msg);
    } finally {
      setAdvisorLoading(false);
    }
  };

  return {
    user,
    applications,
    latestApplication,
    advisorStatus,
    advisorModalOpen,
    setAdvisorModalOpen,
    advisorLoading,
    advisorError,
    advisorSuccess,
    advisorForm,
    setAdvisorForm,
    submitAdvisorApplication,
  };
}
