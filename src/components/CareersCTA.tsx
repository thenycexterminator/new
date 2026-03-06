import { PHONE, EMAIL } from "@/lib/seo";

type Variant = "hero" | "mid" | "final";

interface CareersCTAProps {
  variant: Variant;
  neighborhood?: string;
}

const phonePlain = PHONE.replace(/-/g, "");

export default function CareersCTA({ variant, neighborhood }: CareersCTAProps) {
  const subject = neighborhood
    ? `Exterminator Job Application — ${neighborhood}`
    : "Exterminator Job Application";

  if (variant === "hero") {
    return (
      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
        <a
          href={`mailto:${EMAIL}?subject=${encodeURIComponent(subject)}`}
          className="inline-flex items-center justify-center rounded-lg bg-green-600 px-6 py-3 text-sm font-semibold text-white hover:bg-green-700"
        >
          Apply Now — Email Us
        </a>
        <a
          href={`sms:${phonePlain}?body=${encodeURIComponent("Hi, I'm interested in exterminator job opportunities.")}`}
          className="inline-flex items-center justify-center rounded-lg border border-zinc-700 px-6 py-3 text-sm font-semibold text-white hover:border-zinc-500 hover:bg-white/5"
        >
          Text Us About Jobs
        </a>
        <a
          href={`tel:${phonePlain}`}
          className="inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-semibold text-green-400 hover:text-green-300"
        >
          Call {PHONE} &rarr;
        </a>
      </div>
    );
  }

  const isLarge = variant === "final";

  return (
    <section className={`bg-green-700 ${isLarge ? "py-20" : "py-14"}`}>
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <h2
          className={`font-bold text-white ${isLarge ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"}`}
        >
          {isLarge
            ? "Start Your Pest Control Career Today."
            : "Ready to Join the Team?"}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-lg text-green-100">
          {isLarge
            ? "Send us your resume or just tell us about yourself. We respond to every application within 48 hours."
            : "We're hiring licensed exterminators and entry-level technicians across the NYC metro area. Competitive pay, full benefits, paid training."}
        </p>
        <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <a
            href={`mailto:${EMAIL}?subject=${encodeURIComponent(subject)}`}
            className="inline-flex items-center rounded-lg bg-white px-6 py-3 text-lg font-semibold text-green-700 hover:bg-green-50"
          >
            Apply Now — Email Us
          </a>
          <a
            href={`sms:${phonePlain}?body=${encodeURIComponent("Hi, I'm interested in exterminator job opportunities.")}`}
            className="inline-flex items-center rounded-lg border-2 border-white px-6 py-3 text-lg font-semibold text-white hover:bg-white/10"
          >
            Text Us About Jobs
          </a>
          <a
            href={`tel:${phonePlain}`}
            className="inline-flex items-center rounded-lg px-6 py-3 text-lg font-semibold text-green-100 hover:text-white"
          >
            Call {PHONE} &rarr;
          </a>
        </div>
      </div>
    </section>
  );
}
