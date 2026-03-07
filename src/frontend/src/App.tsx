import { motion } from "motion/react";

export default function App() {
  const year = new Date().getFullYear();

  return (
    <div className="noise-overlay relative min-h-screen w-full overflow-hidden bg-background flex flex-col items-center justify-center">
      {/* Background radial glow */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, oklch(0.78 0.18 192 / 0.06) 0%, transparent 70%)",
        }}
      />

      {/* Scanline overlay */}
      <div className="scanlines pointer-events-none absolute inset-0 z-0" />

      {/* Corner decorations */}
      <div className="pointer-events-none absolute top-8 left-8 z-10 h-10 w-10 border-t-2 border-l-2 border-primary opacity-40" />
      <div className="pointer-events-none absolute top-8 right-8 z-10 h-10 w-10 border-t-2 border-r-2 border-primary opacity-40" />
      <div className="pointer-events-none absolute bottom-8 left-8 z-10 h-10 w-10 border-b-2 border-l-2 border-primary opacity-40" />
      <div className="pointer-events-none absolute bottom-8 right-8 z-10 h-10 w-10 border-b-2 border-r-2 border-primary opacity-40" />

      {/* Main content */}
      <main
        className="relative z-10 flex flex-col items-center gap-6 px-4 text-center"
        data-ocid="main.section"
      >
        {/* Tag line above */}
        <motion.p
          className="font-mono text-xs tracking-[0.3em] uppercase text-primary opacity-70"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 0.7, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          ICP · Blockchain · Metaverse
        </motion.p>

        {/* Main title */}
        <motion.h1
          className="cyber-title animate-flicker font-display text-[clamp(3rem,12vw,8rem)] font-extrabold leading-none tracking-tight text-primary"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        >
          CyberGenesis
        </motion.h1>

        {/* Divider line */}
        <motion.div
          className="h-px w-48 bg-gradient-to-r from-transparent via-primary to-transparent opacity-60"
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 0.6 }}
          transition={{ duration: 1, delay: 0.4, ease: "easeOut" }}
        />

        {/* Subtitle */}
        <motion.p
          className="font-mono text-sm tracking-[0.2em] uppercase text-muted-foreground"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }}
        >
          Coming soon
        </motion.p>
      </main>

      {/* Footer */}
      <footer className="absolute bottom-6 z-10 w-full text-center">
        <p className="font-mono text-[10px] tracking-widest text-muted-foreground opacity-40">
          © {year}.{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(
              typeof window !== "undefined" ? window.location.hostname : "",
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-2 hover:text-primary hover:opacity-70 transition-colors"
          >
            Built with love using caffeine.ai
          </a>
        </p>
      </footer>
    </div>
  );
}
