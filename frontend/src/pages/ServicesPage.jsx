import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { messageForError } from "../api/errors";
import { useServices } from "../api/useServices";
import PageHero from "../components/PageHero";
import { ErrorState, LoadingState } from "../components/RequestState";
import { servicePresentation } from "../data/services";

export default function ServicesPage() {
  const { error, loading, retry, services } = useServices();
  const presentedServices = services.map(servicePresentation);

  return (
    <div className="pt-24">
      <PageHero background="https://images.unsplash.com/photo-1551076805-e1869033e561?q=80&w=2000&auto=format&fit=crop" eyebrow="Medical Excellence" title="Our Services" copy="Comprehensive medical solutions tailored to your unique health needs." alt="Services background" titleMargin="mb-8" />
      <section className="py-32 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {loading && <LoadingState>Loading services...</LoadingState>}
            {error && <ErrorState message={messageForError(error, "services")} onRetry={retry} />}
            {!loading && !error && presentedServices.length === 0 && <p className="text-slate-600 font-medium">No services are currently available.</p>}
            {presentedServices.map((service) => {
              const Icon = service.icon;
              return (
                <motion.div key={service.id} whileHover={{ y: -10 }} className="bg-white p-10 rounded-[3rem] shadow-sm hover:shadow-2xl transition-all border border-slate-100 group">
                  <div className={`w-16 h-16 ${service.color} rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform`}><Icon size={32} /></div>
                  <h3 className="text-2xl font-black mb-4 text-slate-950 tracking-tight">{service.title}</h3>
                  <p className="text-slate-600 font-medium leading-relaxed mb-6">{service.desc}</p>
                  <Link to="/appointment" className="text-[#00AEEF] font-black text-xs uppercase tracking-widest flex items-center gap-2 group-hover:gap-4 transition-all">Book Service <ArrowRight size={14} /></Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
