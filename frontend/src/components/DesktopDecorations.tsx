"use client";

export default function DesktopDecorations() {
  return (
    <div className="pointer-events-none fixed inset-0 hidden overflow-hidden md:block dark:opacity-30">
      {/* Top-left circle */}
      <div
        className="absolute top-[10%] left-[8%] h-12 w-12 rounded-full border-2 border-dashed border-purple-200 opacity-60 animate-float"
        aria-hidden="true"
      />

      {/* Left middle circle */}
      <div
        className="absolute top-[35%] left-[12%] h-6 w-6 rounded-full border border-blue-200 opacity-50 animate-float-delayed"
        aria-hidden="true"
      />

      {/* Left lower star */}
      <svg
        className="absolute top-[60%] left-[6%] h-8 w-8 text-pink-200 opacity-60 animate-float-slow"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z" />
      </svg>

      {/* Right top circle */}
      <div
        className="absolute top-[12%] right-[10%] h-10 w-10 rounded-full border-2 border-dashed border-green-200 opacity-60 animate-float-slow"
        aria-hidden="true"
      />

      {/* Right middle star */}
      <svg
        className="absolute top-[28%] right-[8%] h-10 w-10 text-yellow-200 opacity-60 animate-float"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z" />
      </svg>

      {/* Right middle circle */}
      <div
        className="absolute top-[45%] right-[14%] h-5 w-5 rounded-full border border-indigo-200 opacity-50 animate-float-delayed"
        aria-hidden="true"
      />

      {/* Right lower star */}
      <svg
        className="absolute top-[70%] right-[10%] h-7 w-7 text-teal-200 opacity-50 animate-float-slow"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z" />
      </svg>

      {/* Bottom left circle */}
      <div
        className="absolute bottom-[15%] left-[15%] h-8 w-8 rounded-full border border-orange-200 opacity-50 animate-float"
        aria-hidden="true"
      />

      {/* Bottom right circle */}
      <div
        className="absolute bottom-[20%] right-[18%] h-4 w-4 rounded-full border border-purple-200 opacity-50 animate-float-delayed"
        aria-hidden="true"
      />
    </div>
  );
}
