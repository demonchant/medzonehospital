import { useEffect, useState } from "react";
import { ArrowRight, ChevronRight, HeartPulse, Star } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Link } from "react-router-dom";
import { messageForError } from "../api/errors";
import { useServices } from "../api/useServices";
import { ErrorState, LoadingState } from "../components/RequestState";
import { servicePresentation } from "../data/services";

const slides = [
  { image: "/unnamed2.png", title: "Your Health, Our Commitment.", subtitle: "Experience world-class healthcare in the heart of Ajah. We combine advanced technology with expert care." },
  { image: "/unnamed3.png", title: "Modern Facilities, Expert Care.", subtitle: "Our state-of-the-art reception and treatment areas are designed for your comfort and well-being." },
  { image: "https://images.unsplash.com/photo-1551076805-e1869033e561?q=80&w=2000&auto=format&fit=crop", title: "Advanced Surgery, Better Results.", subtitle: "Our surgical suites are equipped with the latest technology for minimally invasive and complex procedures." },
];

const testimonials = [
  { name: "Smith Kehinde Busari", text: "Highly professional and satisfactory ambience. The staff were very attentive and the facility is top-notch.", date: "6 months ago", img: "https://picsum.photos/seed/patient1/200/200" },
  { name: "MC Banuso", text: "Healthy environment and great service. I felt very comfortable during my stay at Medzone.", date: "6 months ago", img: "https://picsum.photos/seed/patient2/200/200" },
  { name: "Christian Stephen Thomas", text: "Excellent healthcare provider in Ajah. The doctors are knowledgeable and the treatment was effective.", date: "1 year ago", img: "https://picsum.photos/seed/patient3/200/200" },
];

export default function HomePage() {
  const [slide, setSlide] = useState(0);
  const { error: servicesError, loading: servicesLoading, retry: retryServices, services } = useServices();
  const featuredServices = services.slice(0, 6).map(servicePresentation);

  useEffect(() => {
    const timer = setInterval(() => setSlide((current) => (current + 1) % slides.length), 6000);
    return () => clearInterval(timer);
  }, []);

  const currentSlide = slides[slide];
  const [titleStart, titleEnd] = currentSlide.title.split(",");

  return (
    <div className="overflow-hidden">
      <section className="relative min-h-screen flex items-center pt-32 pb-20 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div key={slide} initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 1.2, ease: "easeOut" }} className="absolute inset-0 z-0">
            <img src={currentSlide.image} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/80 to-slate-950/40" />
          </motion.div>
        </AnimatePresence>
        <div className="container mx-auto px-4 relative z-10">
          <motion.div key={`${slide}-content`} initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.2 }} className="max-w-3xl text-white">
            <h1 className="text-5xl md:text-8xl font-black mb-8 leading-[0.9] tracking-tighter drop-shadow-2xl">{titleStart}, <br /><span className="text-[#00AEEF]">{titleEnd}</span></h1>
            <p className="text-lg md:text-xl text-slate-100 mb-12 leading-relaxed max-w-xl font-medium drop-shadow-lg">{currentSlide.subtitle}</p>
            <div className="flex flex-wrap gap-6">
              <Link to="/appointment" className="bg-[#00AEEF] hover:bg-[#0054A6] text-white px-10 py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-2xl shadow-[#00AEEF]/30 flex items-center gap-3">Book Appointment <ArrowRight size={20} /></Link>
              <Link to="/services" className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border border-white/20 px-10 py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all">Our Services</Link>
            </div>
            <div className="mt-16 flex gap-4">
              {slides.map((_, index) => <button key={index} onClick={() => setSlide(index)} className={`h-1 transition-all duration-500 rounded-full ${slide === index ? "w-12 bg-[#00AEEF]" : "w-6 bg-white/30"}`} />)}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-32 bg-white">
        <div className="container mx-auto px-4">
          <div className="rounded-[4rem] overflow-hidden shadow-2xl h-[500px] relative group mb-24">
            <img src="https://images.unsplash.com/photo-1502740479091-635887520276?q=80&w=2000&auto=format&fit=crop" alt="Pediatric Care" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" referrerPolicy="no-referrer" />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/40 to-transparent flex items-center p-12 md:p-24">
              <div className="max-w-xl space-y-6">
                <span className="text-[#00AEEF] font-black tracking-[0.4em] uppercase text-sm">Specialized Care</span>
                <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter leading-none">Pediatric Excellence</h2>
                <p className="text-xl md:text-2xl text-slate-200 font-medium leading-relaxed">Dedicated healthcare for your little ones, provided with love and expertise.</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col lg:flex-row items-center gap-24">
            <div className="lg:w-1/2 relative">
              <div className="relative z-10 rounded-[3rem] overflow-hidden shadow-2xl"><img src="unnamed.png" alt="Medzone Hospital Ward" className="w-full h-[500px] object-cover" referrerPolicy="no-referrer" /></div>
              <div className="absolute -bottom-10 -right-10 w-64 h-64 rounded-[3rem] overflow-hidden shadow-2xl -z-0 hidden md:block border-8 border-white"><img src="/unnamed3.png" alt="Medzone Medical Team" className="w-full h-full object-cover" referrerPolicy="no-referrer" /></div>
              <div className="absolute -top-10 -left-10 w-40 h-40 border-[12px] border-[#00AEEF]/10 rounded-full -z-0 hidden md:block" />
            </div>
            <div className="lg:w-1/2 space-y-10">
              <div className="space-y-6">
                <span className="text-[#00AEEF] font-black tracking-[0.3em] uppercase text-xs">About Medzone</span>
                <h2 className="text-4xl md:text-6xl font-black text-slate-950 leading-tight tracking-tighter">Leading the Way in Medical Excellence</h2>
                <p className="text-xl text-slate-600 leading-relaxed font-medium">Medzone Hospital is a premier healthcare institution located in Lekki, Lagos. We are dedicated to providing high-quality, patient-centered medical services. Our facility is equipped with state-of-the-art technology and staffed by a team of highly skilled professionals.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {["24/7 Emergency Care", "Expert Specialist Doctors", "Modern Diagnostic Lab", "Professional Nursing", "Affordable Healthcare", "Clean & Safe Environment"].map((item) => (
                  <div key={item} className="flex items-center gap-4"><div className="w-8 h-8 bg-[#00AEEF]/10 rounded-xl flex items-center justify-center text-[#00AEEF]"><ChevronRight size={18} /></div><span className="font-bold text-slate-800 tracking-tight">{item}</span></div>
                ))}
              </div>
              <Link to="/about" className="inline-flex items-center gap-3 text-[#0054A6] font-black uppercase tracking-widest text-sm hover:gap-5 transition-all">Learn More About Us <ArrowRight size={20} className="text-[#00AEEF]" /></Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-32 bg-slate-50">
        <div className="container mx-auto px-4">
          <SectionHeading eyebrow="Our Expertise" title="Comprehensive Healthcare Services" copy="We offer a wide range of medical services designed to meet the diverse needs of our community." />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {servicesLoading && <LoadingState>Loading services...</LoadingState>}
            {servicesError && <ErrorState message={messageForError(servicesError, "services")} onRetry={retryServices} />}
            {!servicesLoading && !servicesError && featuredServices.length === 0 && <p className="text-slate-600 font-medium">No services are currently available.</p>}
            {featuredServices.map((service) => {
              const Icon = service.icon;
              return <motion.div key={service.id} whileHover={{ y: -15 }} className="bg-white p-10 rounded-[3rem] shadow-sm hover:shadow-2xl transition-all border border-slate-100 group">
                <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center text-[#00AEEF] mb-8 group-hover:bg-[#00AEEF] group-hover:text-white transition-all duration-500 shadow-inner"><Icon size={40} /></div>
                <h3 className="text-2xl font-black mb-4 text-slate-950 tracking-tight">{service.title}</h3>
                <p className="text-slate-600 mb-8 leading-relaxed font-medium">{service.desc}</p>
                <Link to="/services" className="text-[#0054A6] font-black uppercase tracking-widest text-xs flex items-center gap-2 group-hover:gap-4 transition-all">Read More <ChevronRight size={18} className="text-[#00AEEF]" /></Link>
              </motion.div>;
            })}
          </div>
        </div>
      </section>

      <section className="py-32 bg-white overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none"><div className="absolute top-20 left-10 w-96 h-96 bg-[#00AEEF] rounded-full blur-[100px]" /><div className="absolute bottom-20 right-10 w-96 h-96 bg-[#0054A6] rounded-full blur-[100px]" /></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-20">
            <span className="text-[#00AEEF] font-black tracking-[0.3em] uppercase text-xs mb-4 block">Patient Stories</span>
            <h2 className="text-4xl md:text-6xl font-black text-slate-950 mb-6 tracking-tighter">What Our Patients Say</h2>
            <div className="flex justify-center gap-1 text-yellow-400 mb-4">{[...Array(5)].map((_, index) => <Star key={index} fill="currentColor" size={24} />)}</div>
            <p className="text-slate-500 font-black uppercase tracking-widest text-sm">4.25 Google Reviews</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {testimonials.map((testimonial, index) => <div key={index} className="bg-slate-50 p-10 rounded-[3rem] border border-slate-100 relative group hover:bg-white hover:shadow-2xl transition-all duration-500">
              <div className="absolute -top-6 left-10 text-[#00AEEF] opacity-10 group-hover:opacity-30 transition-opacity"><HeartPulse size={80} /></div>
              <p className="text-slate-700 italic mb-10 relative z-10 text-lg leading-relaxed font-medium">&quot;{testimonial.text}&quot;</p>
              <div className="flex items-center gap-5"><div className="w-16 h-16 bg-[#0054A6] rounded-2xl overflow-hidden shadow-lg"><img src={testimonial.img} alt={testimonial.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /></div><div><h4 className="font-black text-slate-950 tracking-tight">{testimonial.name}</h4><p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{testimonial.date}</p></div></div>
            </div>)}
          </div>
        </div>
      </section>

      <section className="py-32 bg-slate-50">
        <div className="container mx-auto px-4">
          <SectionHeading eyebrow="Our Facility" title="A Closer Look at Medzone" copy="We take pride in maintaining a clean, modern, and welcoming environment for all our patients." />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[{ img: "/unnamed3.png", title: "Welcoming Reception" }, { img: "https://images.unsplash.com/photo-1551076805-e1869033e561?q=80&w=1200&auto=format&fit=crop", title: "Advanced Surgery" }, { img: "/unnamed.png", title: "Comfortable Waiting Area" }].map((item, index) => <motion.div key={index} whileHover={{ scale: 1.02 }} className="relative group overflow-hidden rounded-[3rem] shadow-xl aspect-video"><img src={item.img} alt={item.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" referrerPolicy="no-referrer" /><div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-end p-10"><h4 className="text-white font-black text-2xl tracking-tight">{item.title}</h4></div></motion.div>)}
          </div>
        </div>
      </section>

      <section className="py-20"><div className="container mx-auto px-4"><div className="relative h-[600px] rounded-[4rem] overflow-hidden shadow-2xl group"><img src="https://images.unsplash.com/photo-1516549655169-df83a0774514?q=80&w=2000&auto=format&fit=crop" className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" alt="Medzone Hospital" referrerPolicy="no-referrer" /><div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent flex items-end p-12 md:p-24"><div className="max-w-3xl space-y-6"><h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter leading-none">Your Trusted Partner <br /> in Health and Wellness</h2><p className="text-xl text-slate-300 font-medium max-w-xl">We are committed to providing the highest standard of medical care to our community.</p><Link to="/appointment" className="inline-flex bg-[#00AEEF] text-white px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-[#0054A6] transition-all shadow-2xl">Start Your Journey</Link></div></div></div></div></section>

      <section className="py-20"><div className="container mx-auto px-4"><div className="bg-blue-900 rounded-[4rem] p-12 md:p-20 relative overflow-hidden shadow-2xl"><div className="absolute inset-0 opacity-20"><img src="/unnamed3.png" alt="Medzone" className="w-full h-full object-cover" referrerPolicy="no-referrer" /></div><div className="absolute top-0 right-0 w-1/2 h-full bg-blue-950/40 skew-x-12 translate-x-1/4 backdrop-blur-sm" /><div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-12"><div className="max-w-2xl text-center lg:text-left"><h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Ready to Experience Better Healthcare?</h2><p className="text-xl text-blue-100 mb-0">Book your appointment today and take the first step towards a healthier you.</p></div><div className="flex flex-wrap justify-center gap-4"><Link to="/appointment" className="bg-white text-blue-900 px-10 py-5 rounded-full font-bold text-lg hover:bg-blue-50 transition-all shadow-xl">Book Now</Link><Link to="/contact" className="bg-blue-600 text-white px-10 py-5 rounded-full font-bold text-lg hover:bg-blue-700 transition-all border border-blue-500">Contact Us</Link></div></div></div></div></section>
    </div>
  );
}

function SectionHeading({ eyebrow, title, copy }) {
  return <div className="text-center max-w-3xl mx-auto mb-20 space-y-6"><span className="text-[#00AEEF] font-black tracking-[0.3em] uppercase text-xs">{eyebrow}</span><h2 className="text-4xl md:text-6xl font-black text-slate-950 tracking-tighter">{title}</h2><p className="text-xl text-slate-600 font-medium">{copy}</p></div>;
}
