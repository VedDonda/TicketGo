// Login component for authentication
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import FormField from "../components/FormField";
import { loginRequest, saveSession } from "../services/authService";
import { forgotPassword, resetPassword } from "../services/userService";
const cls = {
  title: "text-[1.9rem] font-bold text-text-primary mb-[6px] tracking-[-0.4px]",
  subtitle: "text-[0.9rem] text-text-secondary mb-[28px]",
  alertBase: "p-[11px_16px] rounded-sm text-[0.85rem] font-medium mb-[18px]",
  alertErr:
    "bg-[rgba(224,92,106,0.12)] text-error border border-[rgba(224,92,106,0.25)]",
  alertOk:
    "bg-[rgba(78,202,139,0.12)] text-success border border-[rgba(78,202,139,0.25)]",
  btn: "w-full p-[13px] bg-accent text-white border-none rounded-sm font-inter text-[0.95rem] font-semibold cursor-pointer transition-all duration-200 mt-2 flex items-center justify-center min-h-[46px] tracking-[0.2px] enabled:hover:bg-accent-hover enabled:hover:-translate-y-[1px] enabled:hover:shadow-[0_6px_20px_rgba(91,95,199,0.45)] active:translate-y-0 disabled:opacity-65 disabled:cursor-not-allowed",
  spinner:
    "w-[18px] h-[18px] border-[2.5px] border-white/30 border-t-white rounded-full animate-spin inline-block",
  footer: "text-center mt-[22px] text-[0.86rem] text-text-secondary",
  link: "text-accent no-underline font-semibold transition-colors duration-200 hover:text-[#8084e8] hover:underline",
};
const FP_STEP = {
  EMAIL: "email",
  OTP: "otp",
  NEW_PASS: "newpass",
  DONE: "done",
};

function ForgotPasswordFlow({ onBack }) {
  const [step, setStep] = useState(FP_STEP.EMAIL);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confPwd, setConfPwd] = useState("");
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const showAlert = (msg, type = "err") => setAlert({ msg, type });

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!email) return showAlert("Email is required");
    setLoading(true);
    setAlert(null);

    try {
      const { ok, data } = await forgotPassword(email);

      if (ok && data.success) {
        showAlert(data.message || "OTP sent", "ok");
        setStep(FP_STEP.OTP);
      } else {
        showAlert(data.message || "Failed to send OTP", "err");
      }
    } catch {
      showAlert("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp) return showAlert("Please enter the OTP");
    setStep(FP_STEP.NEW_PASS);
    setAlert(null);
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (newPwd.length < 6)
      return showAlert("Password must be at least 6 characters");
    if (newPwd !== confPwd) return showAlert("Passwords do not match");
    setLoading(true);
    setAlert(null);

    try {
      const { ok, data } = await resetPassword(email, otp, newPwd);

      if (ok && data.success) {
        showAlert(data.message || "Password reset!", "ok");
        setStep(FP_STEP.DONE);
      } else {
        showAlert(data.message || "Reset failed");

        if (
          data.message?.toLowerCase().includes("expired") ||
          data.message?.toLowerCase().includes("attempt")
        ) {
          setStep(FP_STEP.EMAIL);
        }
      }
    } catch {
      showAlert("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className={cls.title}>Reset Password</h1>
      <p className={cls.subtitle}>
        {step === FP_STEP.EMAIL &&
          "Enter your registered email to receive a reset code."}
        {step === FP_STEP.OTP && `We sent a 6-digit code to ${email}`}
        {step === FP_STEP.NEW_PASS && "Enter your new password."}
        {step === FP_STEP.DONE &&
          "All done! You can now sign in with your new password."}
      </p>
      {alert && (
        <div
          className={`${cls.alertBase} ${alert.type === "err" ? cls.alertErr : cls.alertOk}`}
        >
          {alert.msg}
        </div>
      )}
      {step === FP_STEP.EMAIL && (
        <form onSubmit={handleSendOtp} noValidate>
          <FormField
            id="fp-email"
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setAlert(null);
            }}
            required
          />
          <button className={cls.btn} type="submit" disabled={loading}>
            {loading ? <span className={cls.spinner} /> : "Send Reset Code"}
          </button>
        </form>
      )}
      {step === FP_STEP.OTP && (
        <form onSubmit={handleVerifyOtp} noValidate>
          <FormField
            id="fp-otp"
            label="6-digit Code"
            type="text"
            placeholder="••••••"
            value={otp}
            onChange={(e) => {
              setOtp(e.target.value);
              setAlert(null);
            }}
            required
            autoComplete="one-time-code"
          />
          <button className={cls.btn} type="submit">
            Continue
          </button>
          <button
            type="button"
            onClick={handleSendOtp}
            disabled={loading}
            style={{
              marginTop: 10,
              width: "100%",
              background: "transparent",
              border: "none",
              color: "#8084e8",
              fontSize: "0.85rem",
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
            }}
          >
            {loading ? "Sending..." : "Resend code"}
          </button>
        </form>
      )}
      {step === FP_STEP.NEW_PASS && (
        <form onSubmit={handleReset} noValidate>
          <FormField
            id="fp-newpwd"
            label="New Password"
            type="password"
            placeholder="At least 6 characters"
            value={newPwd}
            onChange={(e) => {
              setNewPwd(e.target.value);
              setAlert(null);
            }}
            required
          />
          <FormField
            id="fp-confpwd"
            label="Confirm New Password"
            type="password"
            placeholder="Repeat password"
            value={confPwd}
            onChange={(e) => {
              setConfPwd(e.target.value);
              setAlert(null);
            }}
            required
          />
          <button className={cls.btn} type="submit" disabled={loading}>
            {loading ? <span className={cls.spinner} /> : "Reset Password"}
          </button>
        </form>
      )}
      {step === FP_STEP.DONE && (
        <button className={cls.btn} onClick={onBack}>
          Back to Sign In
        </button>
      )}
      {step !== FP_STEP.DONE && (
        <p className={cls.footer}>
          <button
            onClick={onBack}
            style={{ background: "none", border: "none", cursor: "pointer" }}
            className={cls.link}
          >
            ← Back to Sign In
          </button>
        </p>
      )}
    </>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const [showForgot, setShowForgot] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAlert(null);
    const errs = {};

    if (!email) errs.email = "Email is required";
    if (!password) errs.password = "Password is required";

    if (Object.keys(errs).length) {
      setErrors(errs);

      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const { ok, data } = await loginRequest(email, password);

      if (!ok) {
        setAlert({ msg: data.message || "Login failed", type: "err" });

        return;
      }

      saveSession(data);
      navigate("/");
    } catch {
      setAlert({ msg: "Network error. Please try again.", type: "err" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      {showForgot ? (
        <ForgotPasswordFlow onBack={() => setShowForgot(false)} />
      ) : (
        <>
          <h1 className={cls.title}>Welcome back</h1>
          <p className={cls.subtitle}>Sign in to your account</p>
          {alert && (
            <div
              className={`${cls.alertBase} ${alert.type === "err" ? cls.alertErr : cls.alertOk}`}
            >
              {alert.msg}
            </div>
          )}
          <form onSubmit={handleSubmit} noValidate>
            <FormField
              id="login-email"
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((p) => ({ ...p, email: null }));
                if (alert) setAlert(null);
              }}
              error={errors.email}
              required
              autoComplete="email"
            />
            <FormField
              id="login-password"
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password)
                  setErrors((p) => ({ ...p, password: null }));
                if (alert) setAlert(null);
              }}
              error={errors.password}
              required
              autoComplete="current-password"
            />
            {}
            <div
              style={{ textAlign: "right", marginTop: -8, marginBottom: 12 }}
            >
              <button
                type="button"
                onClick={() => setShowForgot(true)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                  color: "#8084e8",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                Forgot password?
              </button>
            </div>
            <button className={cls.btn} type="submit" disabled={loading}>
              {loading ? <span className={cls.spinner} /> : "Sign In"}
            </button>
          </form>
          <p className={cls.footer}>
            Don't have an account?{" "}
            <Link to="/signup" className={cls.link}>
              Sign up
            </Link>
          </p>
        </>
      )}
    </AuthLayout>
  );
}
