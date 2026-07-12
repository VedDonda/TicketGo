// Signup component for new users
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import RoleToggle from "../components/RoleToggle";
import FormField from "../components/FormField";
import {
  signupRequest,
  saveSession,
  verifyOtpRequest,
  resendOtpRequest,
} from "../services/authService";
const ROLE_OPTIONS = [
  { label: "Ticket Buyer", value: "CUSTOMER" },
  { label: "Event Host", value: "ORGANIZER" },
];
const authClasses = {
  title: "text-[1.9rem] font-bold text-text-primary mb-[6px] tracking-[-0.4px]",
  subtitle: "text-[0.9rem] text-text-secondary mb-[28px]",
  roleLabel:
    "text-[0.78rem] font-semibold uppercase tracking-[0.8px] text-text-secondary mb-[10px]",
  alertBase: "p-[11px_16px] rounded-sm text-[0.85rem] font-medium mb-[18px]",
  alertErr:
    "bg-[rgba(224,92,106,0.12)] text-error border border-[rgba(224,92,106,0.25)]",
  alertOk:
    "bg-[rgba(78,202,139,0.12)] text-success border border-[rgba(78,202,139,0.25)]",
  submitBtn:
    "w-full p-[13px] bg-accent text-white border-none rounded-sm font-inter text-[0.95rem] font-semibold cursor-pointer transition-all duration-200 mt-2 flex items-center justify-center min-h-[46px] tracking-[0.2px] enabled:hover:bg-accent-hover enabled:hover:-translate-y-[1px] enabled:hover:shadow-[0_6px_20px_rgba(91,95,199,0.45)] active:translate-y-0 disabled:opacity-65 disabled:cursor-not-allowed",
  spinner:
    "w-[18px] h-[18px] border-[2.5px] border-white/30 border-t-white rounded-full animate-spin inline-block",
  footer: "text-center mt-[22px] text-[0.86rem] text-text-secondary",
  link: "text-accent no-underline font-semibold transition-colors duration-200 hover:text-[#8084e8] hover:underline",
};

export default function Signup() {
  const navigate = useNavigate();
  const [role, setRole] = useState("CUSTOMER");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [step, setStep] = useState(1);
  const [otp, setOtp] = useState("");
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e = {};

    if (!name) e.name = "Name is required";
    if (!email) e.email = "Email is required";
    if (!password) e.password = "Password is required";
    else if (password.length < 6) e.password = "Min 6 characters";
    if (password && confirm !== password) e.confirm = "Passwords do not match";

    return e;
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setAlert(null);
    const errs = validate();

    if (Object.keys(errs).length) {
      setErrors(errs);

      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const { ok, data } = await signupRequest(name, email, password, role);

      if (!ok) {
        setAlert({ msg: data.message || "Signup failed", type: "err" });

        return;
      }

      setAlert({ msg: data.message, type: "ok" });
      setStep(2);
    } catch {
      setAlert({ msg: "Network error. Please try again.", type: "err" });
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();

    if (!otp || otp.length < 6) {
      setErrors({ otp: "Please enter the 6-digit code" });

      return;
    }

    setAlert(null);
    setErrors({});
    setLoading(true);

    try {
      const { ok, data } = await verifyOtpRequest(email, otp);

      if (!ok) {
        setAlert({ msg: data.message || "Verification failed", type: "err" });

        if (
          data.message.includes("expired") ||
          data.message.includes("cleared")
        ) {
          setTimeout(() => {
            setStep(1);
            setOtp("");
            setAlert(null);
          }, 3000);
        }

        return;
      }

      if (role === "ORGANIZER") {
        setAlert({ msg: data.message, type: "ok" });
        setTimeout(() => navigate("/login"), 5000);
      } else {
        saveSession(data);
        navigate("/");
      }
    } catch {
      setAlert({ msg: "Network error. Please try again.", type: "err" });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setAlert(null);
    setLoading(true);

    try {
      const { ok, data } = await resendOtpRequest(email);

      setAlert({
        msg: data.message || (ok ? "OTP resent" : "Failed to resend"),
        type: ok ? "ok" : "err",
      });
    } catch {
      setAlert({ msg: "Network error. Please try again.", type: "err" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h1 className={authClasses.title}>
        {step === 1 ? "Create account" : "Verify email"}
      </h1>
      <p className={authClasses.subtitle}>
        {step === 1
          ? "Join thousands of event-goers today"
          : `We sent a code to ${email}`}
      </p>
      {alert && (
        <div
          className={`${authClasses.alertBase} ${alert.type === "err" ? authClasses.alertErr : authClasses.alertOk}`}
        >
          {alert.msg}
        </div>
      )}
      {step === 1 ? (
        <>
          <p className={authClasses.roleLabel}>I am a</p>
          <RoleToggle value={role} onChange={setRole} options={ROLE_OPTIONS} />
          <form onSubmit={handleSignupSubmit} noValidate>
            <FormField
              id="signup-name"
              label="Full Name"
              type="text"
              placeholder="John Doe"
              value={name}
              onChange={(e) => {
                const val = e.target.value;

                setName(val);
                if (errors.name && val)
                  setErrors((prev) => ({ ...prev, name: null }));
                if (alert) setAlert(null);
              }}
              error={errors.name}
              required
              autoComplete="name"
            />
            <FormField
              id="signup-email"
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                const val = e.target.value;

                setEmail(val);
                if (errors.email && val)
                  setErrors((prev) => ({ ...prev, email: null }));
                if (alert) setAlert(null);
              }}
              error={errors.email}
              required
              autoComplete="email"
            />
            <FormField
              id="signup-password"
              label="Password"
              type="password"
              placeholder="Min. 6 characters"
              value={password}
              onChange={(e) => {
                const val = e.target.value;

                setPassword(val);
                if (errors.password && val.length >= 6)
                  setErrors((prev) => ({ ...prev, password: null }));
                if (errors.confirm && val === confirm)
                  setErrors((prev) => ({ ...prev, confirm: null }));
                if (alert) setAlert(null);
              }}
              error={errors.password}
              required
              autoComplete="new-password"
            />
            <FormField
              id="signup-confirm"
              label="Confirm Password"
              type="password"
              placeholder="Re-enter your password"
              value={confirm}
              onChange={(e) => {
                const val = e.target.value;

                setConfirm(val);
                if (errors.confirm && val === password)
                  setErrors((prev) => ({ ...prev, confirm: null }));
                if (alert) setAlert(null);
              }}
              error={errors.confirm}
              required
              autoComplete="new-password"
            />
            <button
              className={authClasses.submitBtn}
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <span className={authClasses.spinner} />
              ) : (
                "Create Account"
              )}
            </button>
          </form>
          <p className={authClasses.footer}>
            Already have an account?{" "}
            <Link to="/login" className={authClasses.link}>
              Sign in
            </Link>
          </p>
        </>
      ) : (
        <form onSubmit={handleOtpSubmit} noValidate>
          <FormField
            id="signup-otp"
            label="6-Digit Code"
            type="text"
            placeholder="123456"
            value={otp}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, "").slice(0, 6);

              setOtp(val);
              if (errors.otp && val.length === 6)
                setErrors((prev) => ({ ...prev, otp: null }));
              if (alert) setAlert(null);
            }}
            error={errors.otp}
            required
            autoComplete="one-time-code"
          />
          <button
            className={authClasses.submitBtn}
            type="submit"
            disabled={loading}
          >
            {loading ? <span className={authClasses.spinner} /> : "Verify Code"}
          </button>
          <p className={authClasses.footer}>
            Didn't receive the code?{" "}
            <button
              type="button"
              onClick={handleResend}
              disabled={loading}
              className={`${authClasses.link} bg-transparent border-none p-0 cursor-pointer text-[0.86rem]`}
            >
              Resend it
            </button>
          </p>
          <p className="text-center mt-2 text-[0.86rem] text-text-secondary">
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setAlert(null);
              }}
              className={`${authClasses.link} bg-transparent border-none p-0 cursor-pointer text-[0.86rem]`}
            >
              Back to Signup
            </button>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
