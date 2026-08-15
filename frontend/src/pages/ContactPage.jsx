import { useEffect, useRef, useState } from "react";
import { HeartPulse, Mail, MapPin, Phone } from "lucide-react";
import { api } from "../api/client";
import { messageForError } from "../api/errors";
import PageHero from "../components/PageHero";

const faqs = [
  { q: "What are your opening hours?", a: "We are open 24 hours a day, 7 days a week, including public holidays." },
  { q: "Do you accept health insurance?", a: "Yes, we partner with major HMOs in Nigeria. Please contact us to verify your specific provider." },
  { q: "How do I book an appointment?", a: "You can book online through our appointment page or call our emergency lines directly." },
];

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ email: "", message: "", name: "", subject: "" });
  const successTimer = useRef(null);

  useEffect(() => () => clearTimeout(successTimer.current), []);

  const updateField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (pending) return;
    setError("");
    setPending(true);
    try {
      await api.contact.submit(form);
      setSubmitted(true);
      setForm({ email: "", message: "", name: "", subject: "" });
      clearTimeout(successTimer.current);
      successTimer.current = setTimeout(() => setSubmitted(false), 5000);
    } catch (requestError) {
      setError(messageForError(requestError, "contact"));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="pt-24">
      <PageHero background="https://images.unsplash.com/photo-1516549655169-df83a0774514?q=80&w=2000&auto=format&fit=crop" eyebrow="Get In Touch" title="Contact Us" copy="Have questions? We're here to help. Reach out to us anytime." alt="Contact background" />
      <section className="py-32">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-24">
            <div className="space-y-16">
              <div className="space-y-8">
                <h2 className="text-4xl md:text-5xl font-black text-slate-950 tracking-tighter">Let&apos;s Talk</h2>
                <p className="text-xl text-slate-600 font-medium leading-relaxed">Feel free to contact us for any inquiries or medical assistance. Our team is available 24/7 to serve you.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <ContactItem icon={Phone} title="Phone"><div className="flex flex-col"><p className="text-slate-600 font-medium">0807 808 9416</p><p className="text-slate-600 font-medium">0706 291 2469</p></div></ContactItem>
                <ContactItem icon={Mail} title="Email"><div className="flex flex-col"><p className="text-slate-600 font-medium">medzonehospital@gmail.com</p><p className="text-slate-600 font-medium">bellomoyosere21@gmail.com</p></div></ContactItem>
                <ContactItem icon={MapPin} title="Address" className="col-span-full"><p className="text-slate-600 font-medium">Plot 2, 9th Avenue, Badore Rd, off First Unity Estate, Ajah, Lagos</p></ContactItem>
              </div>
              <div className="w-full h-96 bg-slate-100 rounded-[3rem] overflow-hidden border border-slate-200 shadow-2xl">
                <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3964.673841682746!2d3.6148383!3d6.4359217!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x103bf90000000001%3A0x0!2zNsKwMjYnMDkuMyJOIDPCsDM2JzUzLjQiRQ!5e0!3m2!1sen!2sng!4v1710000000000!5m2!1sen!2sng" width="100%" height="100%" style={{ border: 0 }} allowFullScreen loading="lazy" title="Google Maps" />
              </div>
              <div className="bg-slate-950 p-12 md:p-16 rounded-[4rem] text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#00AEEF]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <h3 className="text-3xl font-black mb-10 tracking-tight relative z-10">Frequently Asked Questions</h3>
                <div className="space-y-8 relative z-10">{faqs.map((faq, index) => <div key={index} className="space-y-2"><h4 className="font-black text-[#00AEEF] tracking-tight">{faq.q}</h4><p className="text-slate-400 text-sm font-medium leading-relaxed">{faq.a}</p></div>)}</div>
              </div>
            </div>
            <div className="bg-white p-10 md:p-16 rounded-[4rem] shadow-2xl border border-slate-100 relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#00AEEF]/5 rounded-bl-[4rem] -z-0" />
              <h3 className="text-3xl font-black text-slate-950 mb-10 tracking-tight relative z-10">Send Us a Message</h3>
              {submitted ? (
                <div className="bg-green-50 text-green-700 p-12 rounded-[3rem] text-center border border-green-100" role="status" aria-live="polite">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600"><HeartPulse size={40} /></div>
                  <h4 className="text-2xl font-black mb-3 tracking-tight">Message Sent!</h4>
                  <p className="font-medium">Thank you for reaching out. We will get back to you shortly.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-8 relative z-10" aria-busy={pending}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8"><Field label="Full Name"><input required type="text" name="name" value={form.name} onChange={updateField} className={inputClass} placeholder="John Doe" autoComplete="name" /></Field><Field label="Email Address"><input required type="email" name="email" value={form.email} onChange={updateField} className={inputClass} placeholder="john@example.com" autoComplete="email" /></Field></div>
                  <Field label="Subject"><input required type="text" name="subject" value={form.subject} onChange={updateField} className={inputClass} placeholder="How can we help?" /></Field>
                  <Field label="Message"><textarea required rows={5} name="message" value={form.message} onChange={updateField} className={inputClass} placeholder="Your message here..." /></Field>
                  {error && <p className="bg-red-50 text-red-600 p-6 rounded-2xl font-medium" role="alert">{error}</p>}
                  <button disabled={pending} type="submit" className="w-full bg-[#00AEEF] text-white py-6 rounded-2xl font-black text-sm uppercase tracking-[0.2em] hover:bg-[#0054A6] transition-all shadow-2xl shadow-[#00AEEF]/30">{pending ? "Sending..." : "Send Message"}</button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

const inputClass = "w-full px-8 py-5 rounded-2xl bg-slate-50 border border-slate-100 focus:border-[#00AEEF] focus:ring-4 focus:ring-[#00AEEF]/10 outline-none transition-all font-medium";

function Field({ label, children }) { return <div className="space-y-3"><label className="text-xs font-black text-slate-400 uppercase tracking-widest">{label}</label>{children}</div>; }

function ContactItem({ icon: Icon, title, className = "", children }) {
  return <div className={`flex gap-6 ${className}`}><div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-[#00AEEF] shrink-0 shadow-inner"><Icon size={28} /></div><div><h4 className="font-black text-slate-950 tracking-tight text-lg">{title}</h4>{children}</div></div>;
}
