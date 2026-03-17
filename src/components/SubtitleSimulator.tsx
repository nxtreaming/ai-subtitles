"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const DEMO_WORDS = ["Drop", "a", "video.", "Get", "perfect", "subtitles."];

// ms offset from when scanning begins for each word to appear
const WORD_DELAYS_MS = [0, 290, 540, 840, 1130, 1450];

// Duration for the playhead to sweep across the waveform
const SCAN_DURATION = 1700;

// 48 pre-baked bar heights forming a realistic audio-waveform shape
const BAR_HEIGHTS = [
    3, 7, 5, 11, 17, 22, 28, 24, 19, 32, 27, 23, 18, 14, 21, 26,
    31, 29, 23, 17, 14, 19, 24, 29, 34, 31, 25, 21, 16, 12, 19, 25,
    30, 28, 22, 17, 13, 11, 17, 22, 19, 14, 8, 13, 17, 13, 8, 4,
];

// Colors used in imperative DOM updates (keeps React re-renders off the hot path)
const BAR_ACTIVE = "rgba(250,248,246,0.86)";
const BAR_INACTIVE = "rgba(255,255,255,0.09)";

export default function SubtitleSimulator() {
    const [visibleWords, setVisibleWords] = useState<number>(-1);
    const [showDone, setShowDone] = useState(false);
    const [showSubtitle, setShowSubtitle] = useState(false);
    const [activeSubWord, setActiveSubWord] = useState(-1);
    const [cardOpacity, setCardOpacity] = useState(1);

    // Refs for imperative waveform updates (avoids 60fps React re-renders)
    const barsRef = useRef<(HTMLDivElement | null)[]>(
        new Array(BAR_HEIGHTS.length).fill(null)
    );
    const playheadRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef<number | null>(null);
    const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

    useEffect(() => {
        const clearAll = () => {
            timeoutsRef.current.forEach(clearTimeout);
            timeoutsRef.current = [];
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
        };

        const add = (fn: () => void, ms: number) => {
            const id = setTimeout(fn, ms);
            timeoutsRef.current.push(id);
        };

        const resetWaveform = () => {
            barsRef.current.forEach((bar) => {
                if (bar) bar.style.backgroundColor = BAR_INACTIVE;
            });
            if (playheadRef.current) playheadRef.current.style.left = "0%";
        };

        function runCycle() {
            clearAll();

            // Snap-reset state (happens while card is faded out from previous cycle)
            setVisibleWords(-1);
            setShowDone(false);
            setShowSubtitle(false);
            setActiveSubWord(-1);
            resetWaveform();

            // Fade the card back in
            setCardOpacity(1);

            // ── Phase 1: scanning starts at 700ms ─────────────────────────────
            add(() => {
                const t0 = performance.now();

                const tick = (now: number) => {
                    const elapsed = now - t0;
                    const progress = Math.min(elapsed / SCAN_DURATION, 1);
                    const threshold = Math.floor(progress * BAR_HEIGHTS.length);

                    if (playheadRef.current) {
                        playheadRef.current.style.left = `${progress * 100}%`;
                    }

                    barsRef.current.forEach((bar, i) => {
                        if (!bar) return;
                        bar.style.backgroundColor =
                            i < threshold ? BAR_ACTIVE : BAR_INACTIVE;
                    });

                    if (progress < 1) {
                        rafRef.current = requestAnimationFrame(tick);
                    }
                };

                rafRef.current = requestAnimationFrame(tick);

                // Reveal transcript tokens as the playhead sweeps
                WORD_DELAYS_MS.forEach((delay, i) => {
                    add(() => setVisibleWords(i), delay);
                });
            }, 700);

            // ── Phase 2: done badge (300ms after scan finishes) ───────────────
            add(() => setShowDone(true), 2700);

            // ── Phase 3: subtitle output with word-by-word highlight ──────────
            add(() => {
                setShowSubtitle(true);
                DEMO_WORDS.forEach((_, i) => {
                    add(() => setActiveSubWord(i), 500 + i * 400);
                });
            }, 3650);

            // ── Phase 4: fade out ─────────────────────────────────────────────
            add(() => setCardOpacity(0), 6900);

            // ── Phase 5: reset + restart ──────────────────────────────────────
            // Card is fully invisible by now (700ms fade → done at 7600ms)
            add(() => runCycle(), 7700);
        }

        runCycle();
        return clearAll;
    }, []);

    return (
        <div
            className="bg-card border border-border/70 rounded-2xl overflow-hidden"
            style={{
                opacity: cardOpacity,
                transition: "opacity 700ms ease-in-out",
            }}
        >
            {/* ── Title bar ─────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
                <div className="flex items-center gap-1.5">
                    {/* macOS-style traffic lights */}
                    <div className="w-[10px] h-[10px] rounded-full bg-[#ff5f57]/80" />
                    <div className="w-[10px] h-[10px] rounded-full bg-[#febc2e]/80" />
                    <div className="w-[10px] h-[10px] rounded-full bg-[#28c840]/80" />
                    <span className="font-mono text-[11px] text-muted-foreground/40 ml-3 tracking-wide select-none">
                        my-video.mp4
                    </span>
                </div>

                <AnimatePresence mode="wait">
                    {showDone ? (
                        <motion.div
                            key="done"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] as const }}
                            className="flex items-center gap-1.5 font-mono text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full"
                        >
                            ✓ 1.8s
                        </motion.div>
                    ) : (
                        <motion.div
                            key="processing"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground/40"
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500/60 animate-pulse" />
                            processing
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ── Waveform ───────────────────────────────────────────────────── */}
            <div className="px-6 pt-5 pb-5 border-b border-border/40">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/30 block mb-3">
                    audio
                </span>
                <div className="relative flex items-end gap-[3px] h-9 overflow-hidden">
                    {BAR_HEIGHTS.map((height, i) => (
                        <div
                            key={i}
                            ref={(el: HTMLDivElement | null) => {
                                barsRef.current[i] = el;
                            }}
                            className="w-[3px] rounded-full flex-shrink-0"
                            style={{
                                height: `${height}px`,
                                backgroundColor: BAR_INACTIVE,
                            }}
                        />
                    ))}

                    {/* Playhead — a soft vertical gradient line */}
                    <div
                        ref={playheadRef}
                        className="absolute inset-y-0 w-px pointer-events-none"
                        style={{
                            left: "0%",
                            background:
                                "linear-gradient(to bottom, transparent 0%, rgba(250,248,246,0.5) 20%, rgba(250,248,246,0.5) 80%, transparent 100%)",
                        }}
                    />
                </div>
            </div>

            {/* ── Transcript tokens ──────────────────────────────────────────── */}
            <div className="px-6 py-4 border-b border-border/40">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/30 block mb-3">
                    transcript
                </span>
                <div className="flex flex-wrap gap-2 min-h-[30px] items-center">
                    <AnimatePresence>
                        {DEMO_WORDS.map((word, i) =>
                            visibleWords >= i ? (
                                <motion.span
                                    key={i}
                                    initial={{ opacity: 0, y: 8, scale: 0.86 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    transition={{
                                        duration: 0.26,
                                        ease: [0.22, 1, 0.36, 1] as const,
                                    }}
                                    className="font-mono text-xs px-2.5 py-1 rounded-lg bg-muted/50 text-muted-foreground border border-border/60"
                                >
                                    {word}
                                </motion.span>
                            ) : null
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* ── Subtitle output ────────────────────────────────────────────── */}
            <div className="px-6 py-6 flex items-center justify-center min-h-[92px]">
                <AnimatePresence mode="wait">
                    {showSubtitle ? (
                        <motion.div
                            key="output"
                            initial={{ opacity: 0, y: 14, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -8, scale: 0.97 }}
                            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] as const }}
                            className="inline-flex flex-wrap justify-center gap-x-[0.32em] gap-y-1 bg-black/65 rounded-2xl px-8 py-4 border border-white/[0.06]"
                        >
                            {DEMO_WORDS.map((word, i) => (
                                <span
                                    key={i}
                                    className={cn(
                                        "text-xl md:text-2xl font-bold tracking-tight transition-colors duration-200",
                                        i === activeSubWord
                                            ? "text-amber-200 [filter:drop-shadow(0_0_10px_rgba(251,191,36,0.35))]"
                                            : "text-white/38"
                                    )}
                                >
                                    {word}
                                </span>
                            ))}
                        </motion.div>
                    ) : (
                        <motion.p
                            key="waiting"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="font-mono text-[11px] tracking-widest text-muted-foreground/25 uppercase select-none"
                        >
                            subtitle output
                        </motion.p>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
