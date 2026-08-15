import {
  Activity,
  Baby,
  FlaskConical,
  HeartPulse,
  Phone,
  Scan,
  Scissors,
  Stethoscope,
} from "lucide-react";

export const featuredServices = [
  { title: "General Hospital", icon: Stethoscope, desc: "Comprehensive medical care for all ages and conditions." },
  { title: "Obstetrics & Gynecology", icon: Baby, desc: "Specialized care for women throughout all stages of life." },
  { title: "Pediatrics", icon: Activity, desc: "Expert medical attention for infants, children, and adolescents." },
  { title: "General Surgery", icon: Scissors, desc: "Advanced surgical procedures with modern equipment." },
  { title: "Laboratory & Diagnostic", icon: FlaskConical, desc: "Accurate testing and diagnostic services for precise treatment." },
  { title: "Ultrasound Scan", icon: Scan, desc: "High-resolution imaging for internal diagnostics and prenatal care." },
];

export const services = [
  { title: "General Hospital", icon: Stethoscope, desc: "Primary care, routine check-ups, and management of chronic conditions.", color: "bg-blue-50 text-blue-600" },
  { title: "Obstetrics & Gynecology", icon: Baby, desc: "Comprehensive prenatal, delivery, and postnatal care, along with gynecological health.", color: "bg-pink-50 text-pink-600" },
  { title: "Pediatrics", icon: Activity, desc: "Specialized healthcare for children from birth through adolescence.", color: "bg-green-50 text-green-600" },
  { title: "General Surgery", icon: Scissors, desc: "A wide range of surgical procedures performed by expert surgeons.", color: "bg-purple-50 text-purple-600" },
  { title: "Laboratory & Diagnostic", icon: FlaskConical, desc: "State-of-the-art lab services for accurate and timely results.", color: "bg-amber-50 text-amber-600" },
  { title: "Ultrasound Scan", icon: Scan, desc: "Advanced imaging for diagnostics and monitoring fetal development.", color: "bg-cyan-50 text-cyan-600" },
  { title: "Antenatal & Delivery", icon: HeartPulse, desc: "Dedicated support for expectant mothers ensuring safe delivery.", color: "bg-rose-50 text-rose-600" },
  { title: "Emergency Care", icon: Phone, desc: "24/7 emergency medical services for critical situations.", color: "bg-red-50 text-red-600" },
];

const fallbackColors = [
  "bg-blue-50 text-blue-600",
  "bg-green-50 text-green-600",
  "bg-purple-50 text-purple-600",
  "bg-cyan-50 text-cyan-600",
];

export function servicePresentation(service, index = 0) {
  const known = services.find((item) => item.title.toLowerCase() === service.name.toLowerCase())
    ?? featuredServices.find((item) => item.title.toLowerCase() === service.name.toLowerCase());
  return {
    ...service,
    color: known?.color ?? fallbackColors[index % fallbackColors.length],
    desc: service.description,
    icon: known?.icon ?? HeartPulse,
    title: service.name,
  };
}
