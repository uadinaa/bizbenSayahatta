import { Link, useRouteError, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

function getStatus(routeError, searchParams) {
  const fromQuery = Number(searchParams.get("status"));
  if (Number.isInteger(fromQuery) && fromQuery >= 100 && fromQuery <= 599) return fromQuery;

  const routeStatus = Number(routeError?.status);
  if (Number.isInteger(routeStatus) && routeStatus >= 100 && routeStatus <= 599) return routeStatus;

  return 500;
}

export default function ErrorPage() {
  const { t } = useTranslation();
  const routeError = useRouteError();
  const [searchParams] = useSearchParams();
  const status = getStatus(routeError, searchParams);
  const title = t(`errors.status.${status}`, { defaultValue: t("errors.defaultTitle") });

  return (
    <div style={{ maxWidth: 760, margin: "40px auto", padding: 20, textAlign: "center" }}>
      <h1 style={{ marginBottom: 8 }}>{status} - {title}</h1>
      <p style={{ color: "#667085", marginBottom: 18 }}>
        {t("errors.description")}
      </p>

      <img
        src={`https://http.cat/${status}`}
        alt={`HTTP ${status}`}
        style={{ width: "100%", maxWidth: 480, borderRadius: 12, border: "1px solid #eee" }}
      />

      <div style={{ marginTop: 18, display: "flex", justifyContent: "center", gap: 10 }}>
        <Link to="/" style={{ textDecoration: "none", padding: "8px 14px", borderRadius: 8, border: "1px solid #d0d5dd" }}>
          {t("errors.goHome")}
        </Link>
        <button type="button" onClick={() => window.location.reload()} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #d0d5dd", background: "#fff", cursor: "pointer" }}>
          {t("errors.retry")}
        </button>
      </div>
    </div>
  );
}
