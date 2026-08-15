import { useState } from "react";
import { api } from "../api/client";
import { messageForError } from "../api/errors";
import { useAuth } from "../auth/useAuth";

const inputClass = "w-full px-8 py-5 rounded-2xl bg-slate-50 border border-slate-100 focus:border-[#00AEEF] outline-none font-medium";
const emptyForm = { email: "", firstName: "", lastName: "", password: "", phone: "" };

export default function AppointmentAuth({ onAuthenticated, sessionMessage }) {
  const { login } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState(emptyForm);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const updateField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const changeMode = (nextMode) => {
    setMode(nextMode);
    setError("");
    setNotice("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (pending) return;
    setError("");
    setNotice("");
    setPending(true);
    try {
      if (mode === "register") {
        await api.auth.register(form);
        setForm((current) => ({ ...emptyForm, email: current.email }));
        setMode("login");
        setNotice("Registration successful. Please log in to book your appointment.");
      } else {
        await login({ email: form.email, password: form.password });
        onAuthenticated();
      }
    } catch (requestError) {
      setError(messageForError(requestError, "auth"));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[#00AEEF] font-black uppercase tracking-widest text-xs mb-4">Patient Access</p>
        <h3 className="text-3xl font-black text-slate-950 tracking-tight">
          {mode === "login" ? "Log in to book" : "Create a patient account"}
        </h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-8">
        {mode === "register" && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Field label="First Name"><input required name="firstName" value={form.firstName} onChange={updateField} className={inputClass} autoComplete="given-name" /></Field>
              <Field label="Last Name"><input required name="lastName" value={form.lastName} onChange={updateField} className={inputClass} autoComplete="family-name" /></Field>
            </div>
            <Field label="Phone Number"><input required type="tel" name="phone" value={form.phone} onChange={updateField} className={inputClass} autoComplete="tel" /></Field>
          </>
        )}
        <Field label="Email Address"><input required type="email" name="email" value={form.email} onChange={updateField} className={inputClass} autoComplete="email" /></Field>
        <Field label="Password"><input required type="password" name="password" value={form.password} onChange={updateField} minLength={mode === "register" ? 12 : 1} maxLength={128} className={inputClass} autoComplete={mode === "register" ? "new-password" : "current-password"} /></Field>
        {sessionMessage && <p className="bg-red-50 text-red-600 p-6 rounded-2xl font-medium" role="alert">{sessionMessage}</p>}
        {notice && <p className="bg-green-50 text-green-700 p-6 rounded-2xl font-medium" role="status">{notice}</p>}
        {error && <p className="bg-red-50 text-red-600 p-6 rounded-2xl font-medium" role="alert">{error}</p>}
        <button disabled={pending} aria-busy={pending} type="submit" className="w-full bg-[#00AEEF] text-white py-6 rounded-2xl font-black text-sm uppercase tracking-[0.2em] hover:bg-[#0054A6] transition-all shadow-2xl shadow-[#00AEEF]/30">
          {pending ? "Please wait..." : mode === "login" ? "Log In" : "Register"}
        </button>
      </form>
      <button type="button" onClick={() => changeMode(mode === "login" ? "register" : "login")} className="text-[#00AEEF] font-black uppercase tracking-widest text-sm hover:text-[#0054A6] transition-colors">
        {mode === "login" ? "Create a patient account" : "Already registered? Log in"}
      </button>
    </div>
  );
}

function Field({ label, children }) {
  return <div className="space-y-3"><label className="text-xs font-black text-slate-400 uppercase tracking-widest">{label}</label>{children}</div>;
}
