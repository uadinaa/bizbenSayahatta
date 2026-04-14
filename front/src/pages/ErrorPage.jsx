
import "../styles/ErrorPage.css";
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

  const title = t(`errors.status.${status}`, {
    defaultValue: t("errors.defaultTitle"),
  });

  return (
    <div className="error-page">
      <div className="error-container">
        <h1 className="error-title">
          {status} - {title}
        </h1>

        <p className="error-description">
          {t("errors.description")}
        </p>

        <img
          className="error-image"
          src={`https://http.cat/${status}`}
          alt={`HTTP ${status}`}
        />

        <div className="error-actions">
          <Link
            to="/"
            style={{
              textDecoration: "none",
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #d0d5dd",
            }}
          >
            {t("errors.goHome")}
          </Link>

          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #d0d5dd",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            {t("errors.retry")}
          </button>
        </div>
      </div>
    </div>
  );
}