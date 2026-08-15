import PageHero from "../components/PageHero";

export default function AboutPage() {
  return (
    <div className="pt-24">
      <PageHero background="/unnamed3.png" eyebrow="Our Story" title="About Medzone" copy="Learn more about our mission, our values, and the team dedicated to your health." alt="About background" titleMargin="mb-8" />
      <section className="py-32">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
            <div className="space-y-12">
              <h2 className="text-4xl md:text-6xl font-black text-slate-950 tracking-tighter">Our Mission & Vision</h2>
              <div className="space-y-8">
                <div className="bg-slate-50 p-10 rounded-[3rem] border-l-[12px] border-[#00AEEF] shadow-sm">
                  <h3 className="text-3xl font-black text-slate-950 mb-4 tracking-tight">Our Mission</h3>
                  <p className="text-slate-600 leading-relaxed font-medium text-lg">To provide exceptional medical care through innovation, compassion, and excellence, ensuring every patient receives the highest standard of treatment in a safe and welcoming environment.</p>
                </div>
                <div className="bg-slate-50 p-10 rounded-[3rem] border-l-[12px] border-[#0054A6] shadow-sm">
                  <h3 className="text-3xl font-black text-slate-950 mb-4 tracking-tight">Our Vision</h3>
                  <p className="text-slate-600 leading-relaxed font-medium text-lg">To be the leading healthcare provider in Nigeria, recognized for our commitment to medical excellence, patient safety, and community well-being.</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <img src="/unnamed1.png" className="rounded-[2rem] shadow-2xl object-cover h-64 w-full" referrerPolicy="no-referrer" alt="Medical facility 1" />
              <img src="/unnamed2.png" className="rounded-[2rem] shadow-2xl mt-12 object-cover h-64 w-full" referrerPolicy="no-referrer" alt="Medical facility 2" />
              <img src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=1200&auto=format&fit=crop" className="rounded-[2rem] shadow-2xl -mt-12 object-cover h-64 w-full" referrerPolicy="no-referrer" alt="Hospital ward" />
              <img src="https://images.unsplash.com/photo-1516549655169-df83a0774514?q=80&w=1200&auto=format&fit=crop" className="rounded-[2rem] shadow-2xl object-cover h-64 w-full" referrerPolicy="no-referrer" alt="Medical team" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
