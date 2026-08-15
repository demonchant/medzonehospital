import { useCallback, useEffect, useRef, useState } from "react";
import { Calendar, ChevronRight } from "lucide-react";
import { api } from "../api/client";
import { isExpiredSession, messageForError } from "../api/errors";
import { useServices } from "../api/useServices";
import { useAuth } from "../auth/useAuth";
import AppointmentAuth from "../components/AppointmentAuth";
import PageHero from "../components/PageHero";
import { ErrorState, LoadingState } from "../components/RequestState";

const inputClass = "w-full px-8 py-5 rounded-2xl bg-slate-50 border border-slate-100 focus:border-[#00AEEF] outline-none font-medium";
const emptyAppointment = { appointmentDate: "", appointmentTime: "", notes: "", serviceId: "" };

export default function AppointmentPage() {
  const { identity, invalidateSession, logout, retrySession, status } = useAuth();
  const [appointmentDraft, setAppointmentDraft] = useState(emptyAppointment);
  const [sessionMessage, setSessionMessage] = useState("");

  const handleSessionExpired = useCallback(() => {
    setSessionMessage("Your session has expired. Please log in again.");
    invalidateSession();
  }, [invalidateSession]);

  const handleAuthenticated = useCallback(() => setSessionMessage(""), []);

  const handleLogout = useCallback(async () => {
    await logout();
    setAppointmentDraft(emptyAppointment);
    setSessionMessage("");
  }, [logout]);

  return (
    <div className="pt-24">
      <PageHero background="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=2000&auto=format&fit=crop" eyebrow="Book Online" title="Book Appointment" copy="Schedule your visit with our expert medical team." alt="Appointment background" />
      <section className="py-16 md:py-32 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto bg-white rounded-3xl md:rounded-[4rem] shadow-2xl overflow-hidden flex flex-col lg:flex-row border border-slate-100">
            <AppointmentSidebar />
            <div className="lg:w-2/3 p-6 md:p-12 lg:p-20">
              {status === "checking" && <LoadingState>Checking your patient session...</LoadingState>}
              {status === "unavailable" && <ErrorState message="Patient access is temporarily unavailable. Please try again." onRetry={retrySession} />}
              {status === "anonymous" && <AppointmentAuth onAuthenticated={handleAuthenticated} sessionMessage={sessionMessage} />}
              {status === "authenticated" && identity.role !== "PATIENT" && <NonPatientAccess logout={handleLogout} />}
              {status === "authenticated" && identity.role === "PATIENT" && (
                <BookingForm
                  form={appointmentDraft}
                  onSessionExpired={handleSessionExpired}
                  logout={handleLogout}
                  setForm={setAppointmentDraft}
                />
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function BookingForm({ form, logout, onSessionExpired, setForm }) {
  const { error: servicesError, loading: servicesLoading, retry: retryServices, services } = useServices();
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [profileAttempt, setProfileAttempt] = useState(0);
  const [availability, setAvailability] = useState({ error: null, key: "", slots: [] });
  const [availabilityAttempt, setAvailabilityAttempt] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const successTimer = useRef(null);

  useEffect(() => () => clearTimeout(successTimer.current), []);

  useEffect(() => {
    const controller = new AbortController();
    api.patients.ownProfile(controller.signal)
      .then(setProfile)
      .catch((requestError) => {
        if (requestError.name === "AbortError") return;
        if (isExpiredSession(requestError)) onSessionExpired();
        else setProfileError(requestError);
      });
    return () => controller.abort();
  }, [onSessionExpired, profileAttempt]);

  const availabilityKey = form.serviceId && form.appointmentDate
    ? `${form.serviceId}:${form.appointmentDate}`
    : "";

  useEffect(() => {
    if (!form.serviceId || !form.appointmentDate) return undefined;
    const controller = new AbortController();
    const key = `${form.serviceId}:${form.appointmentDate}`;
    api.appointments.availability(form.serviceId, form.appointmentDate, controller.signal)
      .then((result) => setAvailability({ error: null, key, slots: result.slots }))
      .catch((requestError) => {
        if (requestError.name !== "AbortError") {
          setAvailability({ error: requestError, key, slots: [] });
        }
      });
    return () => controller.abort();
  }, [availabilityAttempt, form.appointmentDate, form.serviceId]);

  const currentAvailability = availability.key === availabilityKey
    ? availability
    : { error: null, slots: [] };
  const availabilityLoading = Boolean(availabilityKey && availability.key !== availabilityKey);

  const retryProfile = () => {
    setProfile(null);
    setProfileError(null);
    setProfileAttempt((current) => current + 1);
  };

  const retryAvailability = () => {
    setAvailability({ error: null, key: "", slots: [] });
    setAvailabilityAttempt((current) => current + 1);
  };

  const updateField = (event) => {
    const { name, value } = event.target;
    setError("");
    setForm((current) => ({
      ...current,
      [name]: value,
      ...(["appointmentDate", "serviceId"].includes(name) ? { appointmentTime: "" } : {}),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (pending) return;
    setError("");
    setPending(true);
    try {
      await api.appointments.book({
        appointmentDate: form.appointmentDate,
        appointmentTime: form.appointmentTime,
        notes: form.notes.trim() || null,
        serviceId: form.serviceId,
      });
      setSubmitted(true);
      setForm(emptyAppointment);
      clearTimeout(successTimer.current);
      successTimer.current = setTimeout(() => setSubmitted(false), 5000);
    } catch (requestError) {
      if (isExpiredSession(requestError)) {
        onSessionExpired();
      } else if (requestError.code === "SLOT_UNAVAILABLE") {
        setForm((current) => ({ ...current, appointmentTime: "" }));
        setError(messageForError(requestError, "appointment"));
        retryAvailability();
      } else {
        setError(messageForError(requestError, "appointment"));
      }
    } finally {
      setPending(false);
    }
  };

  const handleLogout = async () => {
    setError("");
    try {
      await logout();
    } catch (requestError) {
      setError(messageForError(requestError, "logout"));
    }
  };

  const dismissSuccess = () => {
    clearTimeout(successTimer.current);
    setSubmitted(false);
  };

  if (submitted) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center space-y-8" role="status" aria-live="polite">
        <div className="w-24 h-24 bg-green-100 rounded-[2rem] flex items-center justify-center text-green-600 shadow-inner"><Calendar size={48} /></div>
        <h3 className="text-4xl font-black text-slate-950 tracking-tighter">Appointment Requested!</h3>
        <p className="text-slate-600 max-w-sm font-medium text-lg leading-relaxed">We&apos;ve received your request. Our team will contact you shortly to confirm your date and time.</p>
        <button onClick={dismissSuccess} className="text-[#00AEEF] font-black uppercase tracking-widest text-sm hover:text-[#0054A6] transition-colors">Book Another Appointment</button>
      </div>
    );
  }

  if (profileError) return <ErrorState message={messageForError(profileError, "profile")} onRetry={retryProfile} />;
  if (!profile) return <LoadingState>Loading your patient profile...</LoadingState>;

  return (
    <form onSubmit={handleSubmit} className="space-y-8" aria-busy={pending}>
      <div className="flex justify-between items-center">
        <p className="text-slate-600 font-medium">Booking as {profile.firstName} {profile.lastName}</p>
        <button type="button" onClick={handleLogout} className="text-[#00AEEF] font-black uppercase tracking-widest text-xs hover:text-[#0054A6] transition-colors">Log Out</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8"><Field label="Full Name"><input readOnly value={`${profile.firstName} ${profile.lastName}`} type="text" className={inputClass} /></Field><Field label="Phone Number"><input readOnly value={profile.phone} type="tel" className={inputClass} /></Field></div>
      <Field label="Service Required">
        <select required name="serviceId" value={form.serviceId} onChange={updateField} disabled={servicesLoading || Boolean(servicesError)} className={`${inputClass} appearance-none`}>
          <option value="">{servicesLoading ? "Loading Services..." : "Select a Service"}</option>
          {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
        </select>
      </Field>
      {servicesError && <ErrorState message={messageForError(servicesError, "services")} onRetry={retryServices} />}
      {!servicesLoading && !servicesError && services.length === 0 && <p className="text-slate-600 font-medium">No services are currently available.</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Field label="Preferred Date"><input required type="date" name="appointmentDate" value={form.appointmentDate} onChange={updateField} className={inputClass} /></Field>
        <Field label="Preferred Time">
          <select required name="appointmentTime" value={form.appointmentTime} onChange={updateField} disabled={!availabilityKey || availabilityLoading || Boolean(currentAvailability.error)} className={`${inputClass} appearance-none`}>
            <option value="">{availabilityLoading ? "Loading Times..." : "Select a Time"}</option>
            {currentAvailability.slots.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
          </select>
        </Field>
      </div>
      {availabilityLoading && <LoadingState>Loading available appointment times...</LoadingState>}
      {currentAvailability.error && <ErrorState message={messageForError(currentAvailability.error, "availability")} onRetry={retryAvailability} />}
      {availabilityKey && !availabilityLoading && !currentAvailability.error && currentAvailability.slots.length === 0 && <p className="text-slate-600 font-medium">No appointment times are available for this date.</p>}
      <Field label="Additional Notes"><textarea rows={3} name="notes" value={form.notes} onChange={updateField} className={inputClass} placeholder="Any specific concerns?" /></Field>
      {error && <p className="bg-red-50 text-red-600 p-6 rounded-2xl font-medium" role="alert">{error}</p>}
      <button disabled={pending || !form.appointmentTime} aria-busy={pending} type="submit" className="w-full bg-[#00AEEF] text-white py-6 rounded-2xl font-black text-sm uppercase tracking-[0.2em] hover:bg-[#0054A6] transition-all shadow-2xl shadow-[#00AEEF]/30">{pending ? "Requesting..." : "Request Appointment"}</button>
    </form>
  );
}

function NonPatientAccess({ logout }) {
  const [error, setError] = useState("");
  const handleLogout = async () => {
    setError("");
    try {
      await logout();
    } catch (requestError) {
      setError(messageForError(requestError, "logout"));
    }
  };
  return (
    <div className="space-y-8">
      <p className="bg-red-50 text-red-600 p-6 rounded-2xl font-medium" role="alert">A patient account is required to book an appointment.</p>
      {error && <p className="bg-red-50 text-red-600 p-6 rounded-2xl font-medium" role="alert">{error}</p>}
      <button type="button" onClick={handleLogout} className="text-[#00AEEF] font-black uppercase tracking-widest text-sm hover:text-[#0054A6] transition-colors">Log Out</button>
    </div>
  );
}

function AppointmentSidebar() {
  return (
    <div className="lg:w-1/3 bg-[#0054A6] p-8 md:p-16 text-white flex flex-col justify-between relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="relative z-10">
        <h3 className="text-3xl font-black mb-10 tracking-tight">Why Choose Us?</h3>
        <ul className="space-y-8">
          {["Expert Specialist Doctors", "Modern Medical Equipment", "Patient-First Care Model"].map((item) => <li key={item} className="flex gap-4"><div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center shrink-0 border border-white/20"><ChevronRight size={18} /></div><span className="font-bold tracking-tight">{item}</span></li>)}
        </ul>
      </div>
      <div className="mt-20 relative z-10">
        <p className="text-blue-200 text-xs font-black uppercase tracking-widest mb-2">Need Help?</p>
        <div className="flex flex-col items-center md:items-start"><p className="text-3xl font-black tracking-tighter">0807 808 9416</p><p className="text-3xl font-black tracking-tighter">0706 291 2469</p></div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <div className="space-y-3"><label className="text-xs font-black text-slate-400 uppercase tracking-widest">{label}</label>{children}</div>;
}
