import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  CAlert,
  CButton,
  CCol,
  CContainer,
  CForm,
  CFormInput,
  CInputGroup,
  CInputGroupText,
  CRow,
  CSpinner,
} from "../../../lib/ui.js";
import CIcon from "../../../lib/Icon.js";
import { cilLockLocked, cilUser } from "../../../lib/icons.js";

import api from "../../../lib/axios";
import { useAuth } from "../../../contexts/AuthContext";

const Login = () => {
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  if (authLoading) {
    return (
      <div className="auth-loading-screen">
        <CSpinner color="light" />
      </div>
    );
  }

  if (user) return <Navigate to="/dashboard" replace />;

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    setErrors((prev) => ({
      ...prev,
      [name]: undefined,
      form: undefined,
    }));
  };

  const validate = () => {
    const newErrors = {};

    if (!String(form.identifier || "").trim()) {
      newErrors.identifier = "Enter your username or email.";
    }

    if (!String(form.password || "").trim()) {
      newErrors.password = "Enter your password.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const normalizeFastApiDetail = (detail) => {
    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          const loc = Array.isArray(item?.loc) ? item.loc.join(".") : "";
          const msg = item?.msg || "Validation error";

          return loc ? `${loc}: ${msg}` : msg;
        })
        .join(" | ");
    }

    if (typeof detail === "string") return detail;

    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading || authLoading) return;
    if (!validate()) return;

    try {
      setLoading(true);
      setErrors({});

      const payload = new FormData();
      payload.append("username", form.identifier.trim());
      payload.append("password", form.password);

      const response = await api.post("/auth/login", payload);

      const token = response?.data?.access_token;

      if (!token) {
        throw new Error("Missing access token");
      }

      await login(token);

      navigate("/dashboard", { replace: true });
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const normalized = normalizeFastApiDetail(detail);

      const message =
        normalized ||
        err?.response?.data?.message ||
        "Incorrect username, email or password.";

      setErrors({ form: message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <CContainer className="login-shell">
        <CRow className="justify-content-center">
          <CCol xs={12} sm={10} md={7} lg={6} xl={5} xxl={4}>
            <div className="login-form">
              <div className="login-panel-header">
                <h1>Sign in</h1>
              </div>

              <CForm onSubmit={handleSubmit} noValidate>
                {errors.form && (
                  <CAlert color="danger" className="login-alert" role="alert">
                    {errors.form}
                  </CAlert>
                )}

                <label className="login-field-label" htmlFor="login-identifier">
                  Username or email
                </label>

                <CInputGroup className="login-input">
                  <CInputGroupText>
                    <CIcon icon={cilUser} />
                  </CInputGroupText>

                  <CFormInput
                    id="login-identifier"
                    name="identifier"
                    placeholder="Enter your username or email"
                    autoComplete="username"
                    value={form.identifier}
                    onChange={handleChange}
                    invalid={Boolean(errors.identifier)}
                    aria-invalid={Boolean(errors.identifier)}
                    aria-describedby={
                      errors.identifier ? "login-identifier-error" : undefined
                    }
                  />
                </CInputGroup>

                {errors.identifier && (
                  <div id="login-identifier-error" className="login-error">
                    {errors.identifier}
                  </div>
                )}

                <label className="login-field-label" htmlFor="login-password">
                  Password
                </label>

                <CInputGroup className="login-input">
                  <CInputGroupText>
                    <CIcon icon={cilLockLocked} />
                  </CInputGroupText>

                  <CFormInput
                    id="login-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    value={form.password}
                    onChange={handleChange}
                    invalid={Boolean(errors.password)}
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={
                      errors.password ? "login-password-error" : undefined
                    }
                  />

                  <button
                    className="input-group-text login-eye-icon"
                    type="button"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    onClick={() => setShowPassword((visible) => !visible)}
                  >
                    <i
                      className={showPassword ? "bi bi-eye-slash" : "bi bi-eye"}
                    />
                  </button>
                </CInputGroup>

                {errors.password && (
                  <div id="login-password-error" className="login-error">
                    {errors.password}
                  </div>
                )}

                <CButton
                  color="primary"
                  className="login-submit"
                  type="submit"
                  disabled={loading || authLoading}
                >
                  {loading ? (
                    <>
                      <CSpinner
                        color="light"
                        size="sm"
                        className="login-submit-spinner"
                      />
                      Signing in
                    </>
                  ) : (
                    "Sign in"
                  )}
                </CButton>
              </CForm>
            </div>
          </CCol>
        </CRow>
      </CContainer>
    </div>
  );
};

export default Login;
