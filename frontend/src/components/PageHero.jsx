export default function PageHero({ background, eyebrow, title, copy, alt, titleMargin = "mb-6" }) {
  return (
    <section className="bg-slate-950 py-32 text-center text-white relative overflow-hidden">
      <div className="absolute inset-0">
        <img src={background} className="w-full h-full object-cover opacity-40" referrerPolicy="no-referrer" alt={alt} />
        <div className="absolute inset-0 bg-slate-950/60" />
      </div>
      <div className="container mx-auto px-4 relative z-10">
        <span className="inline-block text-[#00AEEF] font-black tracking-[0.4em] uppercase text-xs mb-6">{eyebrow}</span>
        <h1 className={`text-5xl md:text-7xl font-black ${titleMargin} tracking-tighter`}>{title}</h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto font-medium">{copy}</p>
      </div>
    </section>
  );
}
